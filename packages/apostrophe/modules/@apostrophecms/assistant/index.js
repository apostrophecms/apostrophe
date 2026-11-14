// This module provides `apos.assistant`, the assistant of the admin UI: an
// editor's chats with AI, each request run as one background job on the
// harness's tools and guidance, through the `assistant` door.
//
// Off by default. Unless `enabled` is set and the AI engine is active, it
// adds no routes, no halo and no browser data, and creates no collections.
//
// A chat runs one request at a time; chats run in parallel. The browser tab
// that sends a request owns it: only that browser tab answers the request's
// asks, and the editor's other browser tabs show it read-only. An idle chat
// belongs to no browser tab.
//
// The records are the truth: the browser reads them, and hears of every
// change through the `assistant-chat` bus event (see lib/events.js).

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
    modelDisplay: false,
    // Milliseconds a browser tool that changes the screen waits for a
    // screen hold to clear, then it is refused naming the holder
    screenWait: 15000,
    // A write changing more documents than this in one call asks the editor
    // first; 0 never asks
    maxDocsWithoutConfirm: 5
  },
  icons: {
    'creation-icon': 'Creation',
    'chat-outline-icon': 'ChatOutline',
    'arrow-up-icon': 'ArrowUp',
    'pencil-outline-icon': 'PencilOutline',
    'trash-can-outline-icon': 'TrashCanOutline',
    'stop-icon': 'Stop',
    'check-icon': 'Check'
  },
  init(self) {
    self.validateOptions();
    // Set once the AI engine is active too
    self.active = false;
    self.askKinds = {};
    // Gates added by name, and the tools whose gates were all taken off
    self.gates = {};
    self.ungated = new Set();
    self.addAskKind('browser', { accept: self.acceptBrowserAnswer });
    self.addAskKind('editMode', { accept: self.acceptEditModeAnswer });
    for (const tool of require('./lib/standard-browser-tools')(self)) {
      self.addBrowserTool(tool);
    }
    self.addEditorTools();
    self.enableBrowserData();
  },
  handlers(self) {
    return {
      '@apostrophecms/ai:beforeToolCall': {
        async checkGates(req, payload) {
          await self.checkGates(req, payload);
        },
        // After the gates: the page goes to edit mode only for a write that
        // will run
        async checkEditMode(req, payload) {
          await self.checkEditMode(req, payload);
        }
      },
      '@apostrophecms/ai:afterToolCall': {
        // A screen another request of the browser tab changed comes with
        // this run's next tool result; a browser tool's carries its own
        async addChangedScreen(req, payload) {
          const { result } = payload;
          if (!self.active || (self.apos.harness.getDoor(req)?.door !== 'assistant') ||
            payload.tool.tags?.includes('browser') ||
            !result || (typeof result !== 'object') || Array.isArray(result)) {
            return;
          }
          const screen = await self.takeChangedScreen(req);
          if (screen) {
            payload.result = {
              ...result,
              screen
            };
          }
        }
      },
      'apostrophe:ready': {
        // After the AI engine's own activation, which comes first in the
        // module order
        async activate() {
          if (!self.options.enabled || !self.apos.ai.active) {
            return;
          }
          self.validateEffortOptions();
          await self.ensureCollections();
          await self.loadMarkdown();
          self.active = true;
          self.apos.modal.addTrigger('assistant', {
            componentName: 'AposAssistant',
            label: 'apostrophe:assistantOpen',
            icon: 'creation-icon'
          });
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
        chat: route(async (req) => {
          const chats = [];
          for (const chat of await self.listChats(req)) {
            chats.push(await self.reconcileChat(req, chat));
          }
          return { chats };
        }),
        'chat/:_id': route(async (req) => {
          const found = await self.getChat(req, req.params._id);
          const chat = await self.reconcileChat(req, found);
          const requests = await self.getChatRequests(req, chat._id);
          const reverts = await self.getChatReverts(req, chat._id);
          return {
            chat,
            requests: requests.map(self.renderRequest),
            reverts: reverts.map(self.renderRevert)
          };
        }),
        mention: route(async (req) => ({
          results: await self.findMentions(req, req.query.q)
        }))
      },
      post: {
        chat: route(async (req) => ({
          chat: await self.createChat(req)
        })),
        'chat/:_id/send': route(async (req) => ({
          request: self.renderRequest(await self.send(req, req.params._id, {
            message: req.body.message,
            screen: req.body.screen
          }))
        })),
        'chat/:_id/answer': route(async (req) => ({
          request: self.renderRequest(await self.answer(req, req.params._id, {
            tabId: req.body.tabId,
            callId: req.body.callId,
            answer: req.body.answer,
            screen: req.body.screen
          }))
        })),
        'chat/:_id/skip': route(async (req) => ({
          request: self.renderRequest(await self.skip(req, req.params._id, {
            tabId: req.body.tabId
          }))
        })),
        'chat/:_id/continue-here': route(async (req) => ({
          request: self.renderRequest(await self.continueHere(req, req.params._id, {
            tabId: req.body.tabId,
            screen: req.body.screen
          }))
        })),
        'chat/:_id/stop': route(async (req) => ({
          request: self.renderRequest(await self.stop(req, req.params._id, {
            planCancel: req.body.planCancel === true
          }))
        })),
        'chat/:_id/retry': route(async (req) => ({
          request: self.renderRequest(await self.retry(req, req.params._id, {
            requestId: req.body.requestId,
            screen: req.body.screen
          }))
        })),
        'chat/:_id/revert-check': route(async (req) => {
          const { requestIds, documents } = await self.checkRevert(req, req.params._id, {
            requestId: req.body.requestId,
            tabId: req.body.tabId
          });
          return {
            requestIds,
            documents: self.renderRevert({ documents }).documents
          };
        }),
        'chat/:_id/revert': route(async (req) => ({
          revert: self.renderRevert(await self.revert(req, req.params._id, {
            requestId: req.body.requestId,
            tabId: req.body.tabId,
            cause: req.body.cause
          }))
        })),
        'chat/:_id/revert-retry': route(async (req) => ({
          revert: self.renderRevert(await self.retryRevert(req, req.params._id, {
            revertId: req.body.revertId,
            tabId: req.body.tabId
          }))
        })),
        'chat/:_id/revert-dismiss': route(async (req) => {
          await self.dismissRevert(req, req.params._id, {
            revertId: req.body.revertId
          });
          return {};
        }),
        visibility: route(async (req) => {
          await self.setVisible(req, {
            tabId: req.body.tabId,
            visible: req.body.visible
          });
          return {};
        })
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
  tasks(self) {
    return require('./lib/tasks')(self);
  },
  methods(self) {
    return {
      ...require('./lib/options')(self),
      ...require('./lib/store')(self),
      ...require('./lib/run')(self),
      ...require('./lib/asks')(self),
      ...require('./lib/browser-tools')(self),
      ...require('./lib/editor-tools')(self),
      ...require('./lib/gates')(self),
      ...require('./lib/edit-mode')(self),
      ...require('./lib/screen')(self),
      ...require('./lib/reconcile')(self),
      ...require('./lib/revert')(self),
      ...require('./lib/events')(self),
      ...require('./lib/markdown')(self),
      ...require('./lib/mentions')(self),
      ...require('./lib/render')(self),
      // Only once active: a site without the assistant sends nothing of it
      getBrowserData(req) {
        if (!self.active) {
          return null;
        }
        return {
          action: self.action,
          usageDisplay: self.options.usageDisplay,
          modelDisplay: self.options.modelDisplay,
          screenWait: self.options.screenWait
        };
      }
    };
  }
};
