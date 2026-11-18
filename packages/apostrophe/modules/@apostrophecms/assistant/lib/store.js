// The assistant's records, each in its own collection: `aposChats`, one
// record per chat, `aposChatRequests`, one per request, and
// `aposChatReverts`, one per revert (see revert.js). The owner is part of
// every query, so knowing an id never reaches someone else's chat.
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

const { getFirstTitle } = require('../ui/apos/universal/message.js');
const USAGE_BATCH = 100;

module.exports = (self) => {
  return {
    async ensureCollections() {
      self.chats = await self.apos.db.collection('aposChats');
      self.requests = await self.apos.db.collection('aposChatRequests');
      self.reverts = await self.apos.db.collection('aposChatReverts');
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
      await self.reverts.createIndex({
        chatId: 1,
        createdAt: 1
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

    /**
     * Creates a chat, under the id the browser named it by when given. An
     * id the owner's chat already has answers with that chat; one that is
     * someone else's is not found.
     *
     * @param {object} req
     * @param {object} [options]
     * @param {string} [options._id]
     * @returns {Promise<object>} The chat record.
     */
    async createChat(req, { _id = null } = {}) {
      const named = _id && self.apos.launder.id(_id);
      if (_id && !named) {
        throw self.apos.error('invalid', 'the chat id is not valid');
      }
      const now = new Date();
      const chat = {
        _id: named || self.apos.util.generateId(),
        schemaVersion: SCHEMA_VERSION,
        ownerId: self.getOwnerId(req),
        title: null,
        openRequest: null,
        openRevert: null,
        requestCount: 0,
        createdAt: now,
        updatedAt: now
      };
      try {
        await self.chats.insertOne(chat);
      } catch (e) {
        if (!named || !self.apos.doc.isUniqueError(e)) {
          throw e;
        }
        return self.getChat(req, named);
      }
      await self.publishChat(req, chat._id);
      return chat;
    },

    // The user's chats, newest first, without what each chat saw of the
    // documents it read
    async listChats(req) {
      return self.chats
        .find({ ownerId: self.getOwnerId(req) })
        .project({ seen: 0 })
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

    /**
     * One request of a chat, or a `notfound` error.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {string} requestId
     * @returns {Promise<object>}
     */
    async getChatRequest(req, chatId, requestId) {
      const chat = await self.getChat(req, chatId);
      const request = await self.requests.findOne({
        _id: self.apos.launder.id(requestId),
        chatId: chat._id,
        ownerId: chat.ownerId
      });
      if (!request) {
        throw self.apos.error('notfound');
      }
      return request;
    },

    /**
     * The request already stored under the id the browser named a new one
     * by, or `null`: a send that arrives twice is answered, never run twice.
     * An id of another chat's request, or of someone else's, is not found.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {string} requestId
     * @returns {Promise<object|null>}
     */
    async findSentRequest(req, chatId, requestId) {
      const sent = await self.requests.findOne({ _id: requestId }, {
        projection: {
          ownerId: 1,
          chatId: 1
        }
      });
      if (!sent) {
        return null;
      }
      if ((sent.ownerId !== self.getOwnerId(req)) || (sent.chatId !== chatId)) {
        throw self.apos.error('notfound');
      }
      return self.getRequest(req, requestId);
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
      await self.publishChat(req, chat._id);
      return self.getChat(req, chat._id);
    },

    /**
     * Deletes a chat with everything it owns: its requests and reverts, then
     * its change log entries, then the chat. A chat whose request or revert
     * is running is refused (Stop first); one waiting for an answer is not,
     * since nothing runs. A chat being deleted takes no send or answer, and an
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
        openRevert: null,
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
      await self.reverts.deleteMany({
        chatId: chat._id,
        ownerId: chat.ownerId
      });
      await self.apos.harness.deleteChatChanges(req, chat._id);
      await self.chats.deleteOne({
        _id: chat._id,
        ownerId: chat.ownerId
      });
      await self.publish(req, chat._id, 'chat', { deleted: true });
    },

    /**
     * A chat's title from the text of its first message, by the rule the
     * panel shares (`getFirstTitle`), or `#N`, the chat's number among its
     * owner's chats, when there is no text.
     *
     * @param {object} chat
     * @param {string} text
     * @returns {Promise<string>}
     */
    async getMessageTitle(chat, text) {
      const title = getFirstTitle(text);
      if (title) {
        return title;
      }
      const number = await self.chats.countDocuments({
        ownerId: chat.ownerId,
        createdAt: { $lte: chat.createdAt }
      });
      return `#${number}`;
    },

    /**
     * How often each tool was called across every stored request, every
     * owner's: the tools the assistant door sends, then any no longer
     * registered that a stored transcript called. Most used first.
     *
     * @returns {Promise<{ requests: number, tools: Array<{ name: string,
     *   requests: number, calls: number, retired: boolean }> }>}
     */
    async getToolUsage() {
      const registered = self.apos.harness.getDoorTools('assistant').map(tool => tool.name);
      const usage = new Map(registered.map(name => [ name, {
        name,
        requests: 0,
        calls: 0,
        retired: false
      } ]));
      let requests = 0;
      let after = null;
      for (;;) {
        const batch = await self.requests
          .find(after ? { _id: { $gt: after } } : {})
          .project({ messages: 1 })
          .sort({ _id: 1 })
          .limit(USAGE_BATCH)
          .toArray();
        for (const request of batch) {
          requests++;
          const seen = new Set();
          for (const message of request.messages || []) {
            for (const part of Array.isArray(message.content) ? message.content : []) {
              if (part.type !== 'toolCall') {
                continue;
              }
              if (!usage.has(part.name)) {
                usage.set(part.name, {
                  name: part.name,
                  requests: 0,
                  calls: 0,
                  retired: true
                });
              }
              usage.get(part.name).calls++;
              seen.add(part.name);
            }
          }
          for (const name of seen) {
            usage.get(name).requests++;
          }
        }
        if (batch.length < USAGE_BATCH) {
          break;
        }
        after = batch.at(-1)._id;
      }
      return {
        requests,
        tools: [ ...usage.values() ].sort((one, two) => (two.requests - one.requests) ||
          (two.calls - one.calls) || one.name.localeCompare(two.name))
      };
    },

    newRequest(chat, {
      _id, sequence, tabId, message, mentions, screen, retryOf
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
        ...(mentions?.length && { mentions }),
        screen,
        ...(retryOf && { retryOf }),
        status: 'running',
        messages: [],
        asks: null,
        createdAt: now,
        updatedAt: now
      };
    }
  };
};
