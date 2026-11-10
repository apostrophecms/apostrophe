// The assistant's records, each in its own collection: `aposChats`, one
// record per chat, and `aposChatRequests`, one per request. The owner is part
// of every query, so knowing an id never reaches someone else's chat.
//
// A chat's `openRequest` is its one request at a time: `{ _id, tabId,
// status }` while a request runs or waits for an answer, `null` when the
// chat is idle. Every move of a request (send, wait, answer, skip, end) is
// a conditional update of that slot, so two moves never both succeed. A
// request record is written after its slot is claimed and before its slot
// is freed.

// Raised when a record's shape changes; a migration upgrades older records
const SCHEMA_VERSION = 1;
const TITLE_MAX = 60;

module.exports = (self) => {
  return {
    async ensureCollections() {
      self.chats = await self.apos.db.collection('aposChats');
      self.requests = await self.apos.db.collection('aposChatRequests');
      await self.chats.createIndex({
        ownerId: 1,
        createdAt: -1
      });
      await self.requests.createIndex({
        chatId: 1,
        sequence: 1
      }, { unique: true });
      await self.requests.createIndex({
        ownerId: 1,
        createdAt: -1
      });
    },

    // The owner of everything the assistant stores: a real user. A task's
    // user has no `_id` and owns no chats
    getOwnerId(req) {
      if (!req.user?._id) {
        throw self.apos.error('forbidden');
      }
      return req.user._id;
    },

    async createChat(req) {
      const now = new Date();
      const chat = {
        _id: self.apos.util.generateId(),
        schemaVersion: SCHEMA_VERSION,
        ownerId: self.getOwnerId(req),
        title: null,
        openRequest: null,
        requestCount: 0,
        createdAt: now,
        updatedAt: now
      };
      await self.chats.insertOne(chat);
      return chat;
    },

    // The user's chats, newest first
    async listChats(req) {
      return self.chats
        .find({ ownerId: self.getOwnerId(req) })
        .sort({ createdAt: -1 })
        .toArray();
    },

    async getChat(req, _id) {
      const chat = await self.chats.findOne({
        _id: self.apos.launder.id(_id),
        ownerId: self.getOwnerId(req)
      });
      if (!chat) {
        throw self.apos.error('notfound');
      }
      return chat;
    },

    // A chat's requests in the order they were sent
    async getChatRequests(req, chatId) {
      const chat = await self.getChat(req, chatId);
      return self.requests
        .find({
          chatId: chat._id,
          ownerId: chat.ownerId
        })
        .sort({ sequence: 1 })
        .toArray();
    },

    async getRequest(req, _id) {
      const request = await self.requests.findOne({
        _id,
        ownerId: self.getOwnerId(req)
      });
      if (!request) {
        throw self.apos.error('notfound');
      }
      return request;
    },

    async renameChat(req, _id, title) {
      const clean = self.apos.launder.string(title).replace(/\s+/g, ' ').trim();
      if (!clean) {
        throw self.apos.error('invalid', 'the title is empty');
      }
      const chat = await self.getChat(req, _id);
      await self.chats.updateOne({
        _id: chat._id,
        ownerId: chat.ownerId
      }, {
        $set: {
          title: clean.slice(0, TITLE_MAX),
          updatedAt: new Date()
        }
      });
      return self.getChat(req, chat._id);
    },

    /**
     * Deletes a chat with everything it owns: its requests, then its change
     * log entries, then the chat. A chat whose request is running is
     * refused (Stop first); one waiting for an answer is not, since nothing
     * runs. A chat being deleted takes no send or answer, and an
     * interrupted delete is finished by the next.
     *
     * @param {object} req
     * @param {string} _id The chat's id.
     */
    async deleteChat(req, _id) {
      const chat = await self.getChat(req, _id);
      const { matchedCount } = await self.chats.updateOne({
        _id: chat._id,
        ownerId: chat.ownerId,
        $or: [
          { deleting: true },
          { openRequest: null },
          { 'openRequest.status': 'waiting' }
        ]
      }, {
        $set: { deleting: true }
      });
      if (!matchedCount) {
        throw self.getRefusal(await self.getChat(req, chat._id), {});
      }
      await self.requests.deleteMany({
        chatId: chat._id,
        ownerId: chat.ownerId
      });
      await self.apos.harness.deleteChatChanges(req, chat._id);
      await self.chats.deleteOne({
        _id: chat._id,
        ownerId: chat.ownerId
      });
    },

    /**
     * A chat's title from the text of its first message: the text cut to 60
     * characters at a word boundary, or `#N`, the chat's number among its
     * owner's chats, when there is no text.
     *
     * @param {object} chat
     * @param {string} text
     * @returns {Promise<string>}
     */
    async getMessageTitle(chat, text) {
      const clean = (text || '').replace(/\s+/g, ' ').trim();
      if (!clean) {
        const number = await self.chats.countDocuments({
          ownerId: chat.ownerId,
          createdAt: { $lte: chat.createdAt }
        });
        return `#${number}`;
      }
      if (clean.length <= TITLE_MAX) {
        return clean;
      }
      const cut = clean.slice(0, TITLE_MAX - 1);
      const space = cut.lastIndexOf(' ');
      return `${space > 0 ? cut.slice(0, space) : cut}…`;
    },

    newRequest(chat, {
      _id, sequence, tabId, message
    }) {
      const now = new Date();
      return {
        _id,
        schemaVersion: SCHEMA_VERSION,
        chatId: chat._id,
        ownerId: chat.ownerId,
        sequence,
        tabId,
        message,
        status: 'running',
        messages: [],
        asks: null,
        createdAt: now,
        updatedAt: now
      };
    }
  };
};
