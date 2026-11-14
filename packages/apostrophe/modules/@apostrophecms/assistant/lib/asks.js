// Asks: a tool that can't go on without the editor or a browser tab throws
// "aiInput" with the ask as its data, `{ kind, ... }`, and the run ends
// waiting. The request keeps its asks on the record until the owning
// browser tab answers one, which continues the run on a new job, or skips
// them, which ends the request; any browser tab may stop it instead.
// "Continue here" makes another browser tab the owner of a waiting
// request, every ask included.
//
// Each kind of ask is registered with `addAskKind`; its `accept` turns a
// posted answer into the input the tool reads on `args._context.input`.
// An answer may carry the screen as it is now, which becomes the request's
// screen, its locale included, for the rest of its runs.

module.exports = (self) => {
  return {
    /**
     * Registers a kind of ask.
     *
     * @param {string} name The `kind` a tool's ask names.
     * @param {object} definition
     * @param {(req: object, ask: object, answer: *, context: { screen:
     *   object|null }) => *} definition.accept Turns a posted answer into
     *   the input the asking tool reads, or throws `invalid` to leave the
     *   ask waiting. `screen` is the verified screen posted with the
     *   answer, if any.
     */
    addAskKind(name, { accept }) {
      self.askKinds[name] = { accept };
    },

    /**
     * Answers one of a waiting request's asks and continues its run. Only
     * the browser tab that owns the request answers it.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {object} input
     * @param {string} input.tabId The answering browser tab.
     * @param {string} input.callId The tool call that asked.
     * @param {*} input.answer What the ask's kind accepts.
     * @param {object} [input.screen] The screen after the answer, in the
     *   locale of `req`; it replaces the request's.
     * @returns {Promise<object>} The request record.
     */
    async answer(req, chatId, {
      tabId, callId, answer, screen
    } = {}) {
      const { chat, request } = await self.getWaiting(req, chatId, tabId);
      const ask = request.asks.find(ask => ask.callId === callId);
      if (!ask) {
        throw self.apos.error('notfound', 'no such question');
      }
      const kind = self.askKinds[ask.kind];
      if (!kind) {
        throw self.apos.error('invalid', `no answer is accepted for an ask of kind "${ask.kind}"`);
      }
      const verified = (screen === undefined)
        ? null
        : await self.verifyScreen(req, screen);
      if (verified && (verified.tabId !== request.tabId)) {
        throw self.apos.error('invalid', 'the screen is of another browser tab');
      }
      const input = await kind.accept(req, ask, answer, { screen: verified });
      await self.claimWaiting(req, chat, request, tabId, {
        'openRequest.status': 'running'
      });
      await self.requests.updateOne({
        _id: request._id,
        ownerId: request.ownerId
      }, {
        $set: {
          status: 'running',
          asks: null,
          updatedAt: new Date(),
          ...(verified && { screen: verified })
        },
        // The earlier run's job is over; this run's is stored by `startRun`.
        // The run reads the screen as stored now, a shared one included
        $unset: {
          jobId: 1,
          prior: 1,
          screenChanged: 1
        }
      });
      const running = await self.getRequest(req, request._id);
      if (verified) {
        await self.shareScreen(running, verified);
      }
      await self.publishRequest(req, running);
      try {
        const transcript = await self.getTranscript(chat, running);
        await self.startRun(req, chat, running, {
          messages: [ ...transcript, ...running.messages ],
          prior: transcript.length,
          toolInput: { [ask.callId]: input }
        });
      } catch (e) {
        await self.endRun(req, chat, running, { error: e });
        throw e;
      }
      return self.getRequest(req, request._id);
    },

    /**
     * Skips a waiting request's asks: the request ends, each ask answered
     * `{ answered: false }` and any tool call after it `{ executed: false,
     * reason: 'skipped' }`, so its transcript stands on its own.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {object} input
     * @param {string} input.tabId The browser tab that skips.
     * @returns {Promise<object>} The request record.
     */
    async skip(req, chatId, { tabId } = {}) {
      const { chat, request } = await self.getWaiting(req, chatId, tabId);
      return self.endWaiting(req, chat, request, {
        tabId,
        status: 'skipped'
      });
    },

    /**
     * Ends a waiting request without an answer, `skipped` or `stopped`:
     * each ask answered `{ answered: false }` and any tool call after it
     * `{ executed: false, reason }`, so its transcript stands on its own.
     * Refused with the reason when it no longer waits as read (or, with
     * `tabId`, for that browser tab).
     *
     * @param {object} req
     * @param {object} chat
     * @param {object} request
     * @param {object} options
     * @param {string} [options.tabId] The browser tab that ends it.
     * @param {'skipped'|'stopped'} options.status
     * @returns {Promise<object>} The request record.
     */
    async endWaiting(req, chat, request, { tabId, status }) {
      await self.claimWaiting(req, chat, request, tabId, {
        'openRequest.status': (status === 'stopped') ? 'stopping' : 'skipping'
      });
      const asked = new Set(request.asks.map(ask => ask.callId));
      const now = new Date();
      await self.requests.updateOne({
        _id: request._id,
        ownerId: request.ownerId
      }, {
        $set: {
          status,
          messages: self.completeCalls(request.messages, call => (asked.has(call.id)
            ? { answered: false }
            : {
              executed: false,
              reason: status
            })),
          asks: null,
          updatedAt: now,
          endedAt: now
        }
      });
      await self.closeRequest(req, chat, request);
      await self.publishRequest(req, request);
      return self.getRequest(req, request._id);
    },

    /**
     * Makes a browser tab the owner of a chat's waiting request: from then
     * on only it answers, it serves the request's browser tools, the
     * request's writes lock in its family, and its screen, visible, is the
     * request's. The browser tab that owned it finds the ask no longer its
     * own.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {object} input
     * @param {string} input.tabId The browser tab taking the request over.
     * @param {object} input.screen Its screen, in the locale of `req`.
     * @returns {Promise<object>} The request record.
     */
    async continueHere(req, chatId, { tabId, screen } = {}) {
      const { chat, request } = await self.getWaiting(req, chatId);
      const clean = self.launderTabId(tabId);
      const verified = await self.verifyScreen(req, screen);
      if (verified.tabId !== clean) {
        throw self.apos.error('invalid', 'the screen is of another browser tab');
      }
      await self.claimWaiting(req, chat, request, null, {
        'openRequest.tabId': clean
      });
      await self.requests.updateOne({
        _id: request._id,
        ownerId: request.ownerId
      }, {
        $set: {
          tabId: clean,
          screen: verified,
          updatedAt: new Date()
        },
        $unset: { screenChanged: 1 }
      });
      await self.publishRequest(req, request);
      return self.getRequest(req, request._id);
    },

    // A chat and its request waiting for an answer, refused with the reason
    // otherwise; with `tabId`, only for the browser tab that owns it
    async getWaiting(req, chatId, tabId) {
      const chat = await self.getChat(req, chatId);
      const clean = (tabId === undefined) ? undefined : self.launderTabId(tabId);
      const open = chat.openRequest;
      if (chat.deleting || (open?.status !== 'waiting') ||
        (clean && (open.tabId !== clean))) {
        throw self.getRefusal(chat, {
          tabId: clean,
          waiting: true
        });
      }
      return {
        chat,
        request: await self.getRequest(req, open._id)
      };
    },

    // Moves a waiting request on, `set` applied to the chat, only if it
    // still waits as read (and for `tabId`, when given)
    async claimWaiting(req, chat, request, tabId, set) {
      const { matchedCount } = await self.chats.updateOne({
        _id: chat._id,
        ownerId: chat.ownerId,
        'openRequest._id': request._id,
        'openRequest.status': 'waiting',
        ...(tabId && { 'openRequest.tabId': self.launderTabId(tabId) }),
        deleting: { $ne: true }
      }, {
        $set: {
          ...set,
          updatedAt: new Date()
        }
      });
      if (!matchedCount) {
        throw self.getRefusal(await self.getChat(req, chat._id), {
          tabId,
          waiting: true
        });
      }
    }
  };
};
