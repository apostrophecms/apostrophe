// This module provides `apos.aposAssistant`, the assistant of the admin UI: an
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
// change through the `assistant-chat` bus event (see lib/events.js). An
// action's route answers with what it changed, a request event is followed
// by a read of that request alone, and a step's arguments and result are
// read when the editor opens the step.

module.exports = {
  options: {
    alias: 'aposAssistant',
    enabled: false,
    // effort: the effort route requests run on; the engine's default when
    //   unset
    // The effort route of the chat-title call; 'none' makes no model call
    titleEffort: 'low',
    // The effort route a delegated read and image descriptions run on when
    // the model names none
    delegationEffort: 'low',
    // Model steps per delegated read
    delegationMaxSteps: 15,
    // summaryEffort: the effort route long-chat summaries run on; the
    //   chat's own when unset
    // Model steps per request
    maxSteps: 30,
    // The token counts editors see: 'tokens' or 'none'
    usageDisplay: 'tokens',
    // Whether the reply footer names the vendor and model
    modelDisplay: false,
    // What an opened step shows: 'summary', what it worked on; 'data', its
    // arguments and result, for developers; or 'all', both
    stepDisplay: 'summary',
    // Milliseconds a browser tool that changes the screen waits for a
    // screen hold to clear, then it is refused naming the holder
    screenWait: 15000,
    // A write changing more documents than this in one call asks the editor
    // first; 0 never asks
    maxDocsWithoutConfirm: 5,
    // The most tokens a chat gives the model; the model's own window when
    // that is lower
    contextLimit: 250000,
    // The percent of that budget past which a chat is shortened, 10 to 90,
    // and at least 20000 tokens of it
    contextThreshold: 75,
    // The largest file a request may carry, in bytes
    attachmentMaxBytes: 8 * 1024 * 1024,
    // The largest CSS, JSON, tokens or Markdown file, in bytes
    attachmentMaxTextBytes: 2 * 1024 * 1024,
    // The files a request may carry
    attachmentMaxCount: 4,
    // The images each round of generate_image offers to pick from
    genImageCount: 4,
    // Seconds after a chat's last request until it is deleted; 0 keeps
    // chats until their owner deletes them
    chatExpireAfter: 0
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
  build: {
    // Off, its UI is never built: the browser gets none of it
    enable: options => options.enabled === true
  },
  i18n: {
    // Sent to the browser only while its UI is built
    aposAssistant: {
      browser: true
    }
  },
  init(self) {
    self.validateOptions();
    // Set once the AI engine is active too
    self.active = false;
    self.askKinds = {};
    // What a notice's button does, by name (see lib/notices.js)
    self.noticeActions = {};
    // Browser tools that turn the answer into their result, by name
    self.browserToolAccepts = {};
    // Gates by tool and name, and by tool the names taken off (see
    // lib/gates.js)
    self.gates = {};
    self.removedGates = {};
    // Widget menu entries that open the panel with a prompt, by name (see
    // lib/widget-operations.js)
    self.widgetOperations = {};
    if (Object.keys(self.apos.i18n.locales).length > 1) {
      self.addWidgetOperation('assistantLocalize', {
        label: 'apostrophe:localize',
        icon: 'translate-icon',
        prompt: 'aposAssistant:assistantLocalizePrompt'
      });
    }
    self.addAskKind('browser', { accept: self.acceptBrowserAnswer });
    self.addAskKind('editMode', { accept: self.acceptEditModeAnswer });
    for (const tool of require('./lib/standard-browser-tools')(self)) {
      self.addBrowserTool(tool);
    }
    self.addEditorTools();
    self.addAgentTools();
    self.addAttachmentTools();
    self.addImageTools();
    self.addGlobalStylesGate();
    self.addPublishGate();
    self.enableBrowserData();
  },
  handlers(self) {
    return {
      '@apostrophecms/ai:beforeToolCall': {
        // A document open in an editor is written through that editor; a
        // refused call never asks for approval
        async checkHeldDocuments(req, payload) {
          await self.checkHeldDocuments(req, payload);
        },
        async checkGates(req, payload) {
          await self.checkGates(req, payload);
        },
        // After the gates: the page goes to edit mode only for a write that
        // will run
        async checkEditMode(req, payload) {
          await self.checkEditMode(req, payload);
        }
      },
      '@apostrophecms/harness:documentSeen': {
        // The chat keeps what it saw of each document for its next requests.
        // A revert's saves are not the model's reads: the chat's stamps stay,
        // and a document the revert wrote is read again before it is written
        async storeSeen(req) {
          const door = self.apos.aposHarness.getDoor(req);
          if (!self.active || (door?.door !== 'assistant') || door.revert) {
            return;
          }
          await self.chats.updateOne({ _id: door.chat }, {
            $set: {
              seen: [ ...door.seen ].map(([ _id, updatedAt ]) => ({
                _id,
                updatedAt
              }))
            }
          });
        }
      },
      '@apostrophecms/ai:afterToolCall': {
        // A read of a document open in an editor is what is saved, not what it holds
        async noteHeldDocument(req, payload) {
          await self.noteHeldDocument(req, payload);
        },
        // A Global Styles write says whether this page's locale was written
        async noteGlobalStylesWrite(req, payload) {
          await self.noteGlobalStylesWrite(req, payload);
        },
        // A screen another request of the browser tab changed comes with
        // this run's next tool result; a browser tool's carries its own
        async addChangedScreen(req, payload) {
          const { result } = payload;
          // Not to a subagent's result (its `generate` runs inside a tool),
          // which the run's model never sees
          if (!self.active || (self.apos.aposHarness.getDoor(req)?.door !== 'assistant') ||
            req.aposAiDepth || payload.tool.tags?.includes('browser') ||
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
      'apostrophe:destroy': {
        stopSweeps() {
          self.stopSweeps();
        }
      },
      'apostrophe:ready': {
        // After the AI engine's own activation, which comes first in the
        // module order
        async activate() {
          // Its UI must be in the build too (see `build.enable`): browser
          // data never names an assistant the browser doesn't have
          if (
            !self.options.enabled ||
            !self.apos.ai.active ||
            self.apos.asset.isInactive(self.__meta.name)
          ) {
            return;
          }
          self.validateEffortOptions();
          await self.ensureCollections();
          await self.loadMarkdown();
          self.active = true;
          self.startSweeps();
          self.apos.modal.addTrigger('assistant', {
            componentName: 'AposAssistant',
            label: 'aposAssistant:assistantOpen',
            icon: 'creation-icon'
          });
          // Every widget type's menus, now that the assistant can open
          for (const [ name, { label, icon } ] of Object.entries(self.widgetOperations)) {
            self.apos.area.addWidgetOperation(name, {
              label,
              icon,
              action: 'assistant-widget-operation',
              secondaryLevel: true,
              multiple: true
            });
          }
        }
      }
    };
  },
  middleware(self) {
    if (!self.options.enabled) {
      return {};
    }
    return {
      // Before the route reads it: an editor's save of fields the
      // assistant wrote into it (see lib/outside.js)
      async markOutsideSave(req, res, next) {
        if (!self.active || !req.body?._outside) {
          return next();
        }
        try {
          await self.markOutsideSave(req);
        } catch (e) {
          self.logError(req, 'outside-save', e.message, {
            stack: e.stack
          });
        }
        return next();
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
            chats.push(self.renderChat(await self.reconcileChat(req, chat)));
          }
          return { chats };
        }),
        'chat/:_id': route(async (req) => {
          const chat = await getReconciledChat(req, { length: true });
          const requests = await self.getChatRequests(req, chat._id);
          const reverts = await self.getChatReverts(req, chat._id);
          return {
            chat,
            requests: await self.presentRequests(requests),
            reverts: reverts.map(self.renderRevert)
          };
        }),
        // What a request event changed: the request, and its chat's slot
        'chat/:_id/request/:requestId': route(async (req) => {
          const chat = await getReconciledChat(req, { length: true });
          const request = await self.getChatRequest(req, chat._id,
            req.params.requestId);
          return {
            chat,
            request: await self.presentRequest(request)
          };
        }),
        // A step's arguments and result, once the editor opens it
        'chat/:_id/request/:requestId/step/:stepId': route(async (req) => {
          const request = await self.getChatRequest(req, req.params._id,
            req.params.requestId);
          const stepId = self.apos.launder.string(req.params.stepId);
          const step = await self.renderStep(req, request, stepId);
          if (!step) {
            throw self.apos.error('notfound');
          }
          return step;
        }),
        mention: route(async (req) => ({
          results: await self.findMentions(req, req.query.q)
        })),
        // The chat's files not sent yet, which may be before the chat exists
        'chat/:_id/attachment': route(async (req) => ({
          attachments: await self.listUnsent(req, req.params._id)
        }))
      },
      post: {
        // A new chat is created by its first send, under the id the
        // browser named it by
        'chat/:_id/send': route(async (req) => withChat(req, {
          request: await self.presentRequest(await self.send(req, req.params._id, {
            message: req.body.message,
            screen: req.body.screen,
            requestId: req.body.requestId,
            create: req.body.create === true,
            attachments: req.body.attachments
          }))
        })),
        // A file for the chat's next request, which may create the chat
        'chat/:_id/attachment': route(async (req) => ({
          attachment: await self.uploadAttachment(req, req.params._id)
        })),
        'chat/:_id/answer': route(async (req) => withChat(req, {
          request: await self.presentRequest(await self.answer(req, req.params._id, {
            tabId: req.body.tabId,
            callId: req.body.callId,
            answer: req.body.answer,
            screen: req.body.screen
          }))
        })),
        'chat/:_id/open-editor': route(async (req) => self.serveOpenEditor(req, req.params._id, {
          tabId: req.body.tabId,
          callId: req.body.callId,
          root: req.body.root
        })),
        'chat/:_id/skip': route(async (req) => withChat(req, {
          request: await self.presentRequest(await self.skip(req, req.params._id, {
            tabId: req.body.tabId
          }))
        })),
        // A notice's button, run once as a request of its own
        'chat/:_id/notice-action': route(async (req) => withChat(req, {
          request: await self.presentRequest(await self.runNoticeAction(req,
            req.params._id, {
              requestId: req.body.requestId,
              noticeId: req.body.noticeId,
              screen: req.body.screen
            }))
        })),
        'chat/:_id/continue-here': route(async (req) => withChat(req, {
          request: await self.presentRequest(await self.continueHere(req,
            req.params._id, {
              tabId: req.body.tabId,
              screen: req.body.screen
            }))
        })),
        'chat/:_id/stop': route(async (req) => withChat(req, {
          request: await self.presentRequest(await self.stop(req, req.params._id, {
            planCancel: req.body.planCancel === true
          }))
        })),
        'chat/:_id/retry': route(async (req) => withChat(req, {
          request: await self.presentRequest(await self.retry(req, req.params._id, {
            retryOf: req.body.retryOf,
            requestId: req.body.requestId,
            screen: req.body.screen
          }))
        })),
        'chat/:_id/revert-check': route(async (req) => {
          const { requestIds, documents } = await self.checkRevert(req, req.params._id, {
            requestId: req.body.requestId,
            tabId: req.body.tabId,
            screen: req.body.screen
          });
          return {
            requestIds,
            documents: self.renderRevert({ documents }).documents
          };
        }),
        'chat/:_id/revert': route(async (req) => withChat(req, {
          revert: self.renderRevert(await self.revert(req, req.params._id, {
            requestId: req.body.requestId,
            tabId: req.body.tabId,
            cause: req.body.cause,
            screen: req.body.screen
          }))
        })),
        'chat/:_id/revert-retry': route(async (req) => withChat(req, {
          revert: self.renderRevert(await self.retryRevert(req, req.params._id, {
            revertId: req.body.revertId,
            tabId: req.body.tabId,
            screen: req.body.screen
          }))
        })),
        'chat/:_id/revert-dismiss': route(async (req) => withChat(req, {
          revert: self.renderRevert(await self.dismissRevert(req, req.params._id, {
            revertId: req.body.revertId
          }))
        })),
        // A new chat continuing this one from one of its requests, under
        // the id the browser named it by: the answer is the new chat
        'chat/:_id/continue': route(async (req) => {
          const chat = await self.continueInNewChat(req, req.params._id, {
            requestId: req.body.requestId,
            chatId: req.body.chatId
          });
          return {
            chat: self.renderChat(chat, { thread: true })
          };
        }),
        'chat/:_id/suggestion-dismiss': route(async (req) => {
          await self.dismissSuggestion(req, req.params._id, req.body.suggestionId);
          return withChat(req, {});
        }),
        screen: route(async (req) => {
          await self.postScreen(req, {
            tabId: req.body.tabId,
            screen: req.body.screen
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
        }),
        // A file the composer dropped after its upload, never sent
        'chat/:_id/attachment/:attachmentId': route(async (req) => {
          await self.detach(req, req.params._id, req.params.attachmentId);
          return {};
        })
      }
    };

    // A chat as its thread reads it, the gauge's length with it while the
    // chat is idle: a run holds the last one
    async function getReconciledChat(req, { length = false } = {}) {
      const chat = await self.reconcileChat(req, await self.getChat(req, req.params._id));
      return self.renderChat(chat, {
        thread: true,
        length: (length && !chat.openRequest) ? await self.getChatLength(chat) : null
      });
    }

    // An action's answer carries its chat as it is now, so the browser
    // shows the action's effect without reading again
    async function withChat(req, answer) {
      return {
        ...answer,
        chat: self.renderChat(await self.getChat(req, req.params._id), { thread: true })
      };
    }

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
  routes(self) {
    if (!self.options.enabled) {
      return {};
    }
    return {
      get: {
        // A chat's file, for its owner only
        'chat/:_id/attachment/:attachmentId': (req, res) => self.serveAttachment(req, res)
      }
    };
  },
  tasks(self) {
    return require('./lib/tasks')(self);
  },
  methods(self) {
    return {
      ...require('./lib/options')(self),
      ...require('./lib/store')(self),
      ...require('./lib/files')(self),
      ...require('./lib/run')(self),
      ...require('./lib/asks')(self),
      ...require('./lib/notices')(self),
      ...require('./lib/browser-tools')(self),
      ...require('./lib/editor-tools')(self),
      ...require('./lib/agent-tools')(self),
      ...require('./lib/attachments')(self),
      ...require('./lib/attachment-tools')(self),
      ...require('./lib/image-tools')(self),
      ...require('./lib/retention')(self),
      ...require('./lib/gates')(self),
      ...require('./lib/global-styles')(self),
      ...require('./lib/localization')(self),
      ...require('./lib/widget-operations')(self),
      ...require('./lib/edit-mode')(self),
      ...require('./lib/open-editor')(self),
      ...require('./lib/outside')(self),
      ...require('./lib/screen')(self),
      ...require('./lib/reconcile')(self),
      ...require('./lib/long-chats')(self),
      ...require('./lib/summaries')(self),
      ...require('./lib/revert')(self),
      ...require('./lib/continue')(self),
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
          // The prompt of each widget menu entry, by its name
          widgetOperations: Object.fromEntries(Object.entries(self.widgetOperations)
            .map(([ name, { prompt } ]) => [ name, prompt ])),
          usageDisplay: self.options.usageDisplay,
          modelDisplay: self.options.modelDisplay,
          stepDisplay: self.options.stepDisplay,
          screenWait: self.options.screenWait,
          attachments: {
            // Attaching a file takes the right to upload one
            canUpload: self.apos.permission.can(req, 'upload-attachment'),
            maxBytes: self.options.attachmentMaxBytes,
            maxTextBytes: self.options.attachmentMaxTextBytes,
            textExtensions: self.getTextExtensions(),
            maxCount: self.options.attachmentMaxCount,
            extensions: self.getAttachmentExtensions(),
            unreadable: self.getUnreadableExtensions()
          }
        };
      }
    };
  }
};
