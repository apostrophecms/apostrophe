// Notices: messages a tool posts on its request for the thread, after its
// step: "Saved to Media", "Not saved to Media". A notice is
// `{ _id, callId, tone, title, text, interpolate, link, action }`: `tone`
// `success` or `error`, `title` and `text` i18n keys with `interpolate`'s
// values, `link` a document the editor can open (`{ _id, type, label }`),
// and `action` what its button does (`{ name, label }`), or `null`. The
// panel shows every notice the same way and knows nothing of the tool
// behind it.
//
// An action is registered here by name with its handler, as ask kinds are;
// its data stays on the stored notice and never reaches the browser. The
// button runs it once, as a request of its own with no model call: the
// chat's slot claimed as a send claims it, the handler run under that
// request's door, so what it writes has its change-log entry and revert,
// and the transcript the handler returns stored for the model to replay.
// The thread shows such a request (`action` set) by its notices.

module.exports = (self) => {
  return {
    /**
     * Registers what a notice's button does.
     *
     * @param {string} name The `action.name` a notice names.
     * @param {object} definition
     * @param {(req: object, notice: object) => Promise<object[]>}
     *   definition.run Does it with the request's door `req`, the stored
     *   notice with its `action.data`; returns the messages the model reads
     *   after the request's user line, an assistant tool call and its
     *   result as a run would have stored them. It may post notices; an
     *   error fails the request.
     */
    addNoticeAction(name, { run }) {
      self.noticeActions[name] = { run };
    },

    /**
     * Posts a notice on the door's request.
     *
     * @param {object} req The door's `req`.
     * @param {object} notice `{ callId, tone, title, text, interpolate,
     *   link, action }`; `action.data` is the action's own.
     */
    async addNotice(req, notice) {
      const door = self.apos.harness.getDoor(req);
      if (!door?.requestId) {
        return;
      }
      const request = {
        _id: door.requestId,
        chatId: door.chat,
        ownerId: self.getOwnerId(req)
      };
      await self.requests.updateOne({
        _id: request._id,
        ownerId: request.ownerId
      }, {
        $push: {
          notices: {
            _id: self.apos.util.generateId(),
            callId: notice.callId || null,
            tone: notice.tone,
            title: notice.title,
            text: notice.text || null,
            interpolate: notice.interpolate || {},
            link: notice.link || null,
            action: notice.action || null
          }
        }
      });
      await self.publishRequest(req, request);
    },

    /**
     * Runs a notice's action, once, as a request of its own with no model
     * call. Refused with the reason when the chat is busy, and as `invalid`
     * when the notice has no action or it was run already.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {object} input
     * @param {string} input.requestId The request the notice is on.
     * @param {string} input.noticeId
     * @param {object} input.screen The screen of the browser tab that runs
     *   it, in the locale of `req`.
     * @returns {Promise<object>} The new request's record.
     */
    async runNoticeAction(req, chatId, {
      requestId, noticeId, screen
    } = {}) {
      const chat = await self.getChat(req, chatId);
      const source = await self.getChatRequest(req, chat._id, requestId);
      const _id = self.apos.launder.id(noticeId);
      const notice = source.notices?.find(each => each._id === _id);
      const action = notice?.action && self.noticeActions[notice.action.name];
      if (!action || (source.takenActions || []).includes(_id)) {
        throw self.apos.error('invalid', 'this notice has no action to run');
      }
      const verified = await self.verifyScreen(req, screen);
      const newId = self.apos.util.generateId();
      const claimed = await self.claimChat(req, chat._id, {
        requestId: newId,
        tabId: verified.tabId
      });
      // Taken once: a second click or browser tab finds it gone
      const { matchedCount } = await self.requests.updateOne({
        _id: source._id,
        ownerId: source.ownerId,
        takenActions: { $nin: [ _id ] }
      }, {
        $push: { takenActions: _id }
      });
      if (!matchedCount) {
        await self.chats.updateOne({
          _id: claimed._id,
          'openRequest._id': newId
        }, {
          $set: {
            openRequest: null,
            updatedAt: new Date()
          }
        });
        throw self.apos.error('invalid', 'this notice has no action to run');
      }
      // Every browser tab's button goes
      await self.publishRequest(req, source);
      const request = {
        ...self.newRequest(claimed, {
          _id: newId,
          sequence: claimed.requestCount,
          tabId: verified.tabId,
          message: req.t(notice.action.label),
          screen: verified
        }),
        action: {
          name: notice.action.name,
          requestId: source._id,
          noticeId: _id
        }
      };
      await self.requests.insertOne(request);
      await self.publishRequest(req, request);
      const doorReq = self.getRunReq(req, claimed, request);
      try {
        const messages = await action.run(doorReq, notice);
        await self.endRun(doorReq, claimed, request, {
          result: {
            messages: [ self.getUserMessage(request), ...messages ],
            finishReason: 'stop',
            usage: {}
          },
          prior: 0
        });
      } catch (e) {
        await self.endRun(doorReq, claimed, request, { error: e });
      }
      return self.getRequest(req, request._id);
    }
  };
};
