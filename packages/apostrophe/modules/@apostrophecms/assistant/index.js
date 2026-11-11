// This module provides `apos.assistant`, the assistant of the admin UI: an
// editor's chats with AI, each request run as one background job on the
// harness's tools and guidance, through the `assistant` door.
//
// Off by default. Unless `enabled` is set and the AI engine is active, it
// adds no routes and creates no collections.
//
// A chat runs one request at a time; chats run in parallel. The browser tab
// that sends a request owns it: only that browser tab answers the request's
// asks, and the editor's other browser tabs show it read-only. An idle chat
// belongs to no browser tab.

module.exports = {
  options: {
    alias: 'assistant',
    enabled: false,
    // effort: the effort route requests run on; the engine's default when
    //   unset
    // The effort route of the chat-title call; 'none' makes no model call
    titleEffort: 'low',
    // The effort route a delegated read runs on when the model names none
    delegationEffort: 'low',
    // summaryEffort: the effort route long-chat summaries run on; the
    //   chat's own when unset
    // Model steps per request
    maxSteps: 30,
    // The token counts editors see: 'tokens' or 'none'
    usageDisplay: 'tokens',
    // Whether the reply footer names the vendor and model
    modelDisplay: false
  },
  init(self) {
    self.validateOptions();
    // Set once the AI engine is active too
    self.active = false;
    self.askKinds = {};
  },
  handlers(self) {
    return {
      'apostrophe:ready': {
        // After the AI engine's own activation, which comes first in the
        // module order
        async activate() {
          if (!self.options.enabled || !self.apos.ai.active) {
            return;
          }
          self.validateEffortOptions();
          await self.ensureCollections();
          self.active = true;
        }
      }
    };
  },
  apiRoutes(self) {
    if (!self.options.enabled) {
      return {};
    }
    return {
      get: {
        chat: route(async (req) => ({
          chats: await self.listChats(req)
        })),
        'chat/:_id': route(async (req) => ({
          chat: await self.getChat(req, req.params._id),
          requests: await self.getChatRequests(req, req.params._id)
        }))
      },
      post: {
        chat: route(async (req) => ({
          chat: await self.createChat(req)
        })),
        'chat/:_id/send': route(async (req) => ({
          request: await self.send(req, req.params._id, {
            message: req.body.message,
            screen: req.body.screen
          })
        })),
        'chat/:_id/answer': route(async (req) => ({
          request: await self.answer(req, req.params._id, {
            tabId: req.body.tabId,
            callId: req.body.callId,
            answer: req.body.answer
          })
        })),
        'chat/:_id/skip': route(async (req) => ({
          request: await self.skip(req, req.params._id, {
            tabId: req.body.tabId
          })
        })),
        'chat/:_id/continue-here': route(async (req) => ({
          request: await self.continueHere(req, req.params._id, {
            tabId: req.body.tabId
          })
        }))
      },
      patch: {
        'chat/:_id': route(async (req) => ({
          chat: await self.renameChat(req, req.params._id, req.body.title)
        }))
      },
      delete: {
        'chat/:_id': route(async (req) => {
          await self.deleteChat(req, req.params._id);
          return {};
        })
      }
    };

    // Routes are declared before the AI engine activates; with no engine
    // they answer as if they did not exist
    function route(handler) {
      return async (req) => {
        if (!self.active) {
          throw self.apos.error('notfound');
        }
        self.getOwnerId(req);
        return handler(req);
      };
    }
  },
  methods(self) {
    return {
      ...require('./lib/options')(self),
      ...require('./lib/store')(self),
      ...require('./lib/run')(self),
      ...require('./lib/asks')(self)
    };
  }
};
