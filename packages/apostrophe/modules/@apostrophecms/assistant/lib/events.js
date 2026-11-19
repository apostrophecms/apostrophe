// What the browser hears about chats: one bus event, `assistant-chat`, for
// every browser tab of the chat's owner, since the others show the chat
// read-only. A change is published only once it is stored, with what the
// browser shows at once (a request's status, a chat's title), so a browser
// tab that reads the record on it reads the change. Progress (a tool call,
// a model turn, a provider retry) is published as it happens and is never
// stored. A missed event costs speed, never truth: a browser tab that wakes
// up reloads the records.
//
// `{ chatId, stage, ... }`, stage one of:
//   'chat': the chat record changed (created, renamed, titled; `title`), or
//     was deleted (`deleted: true`)
//   'request': a request record changed (`requestId`, `status`, `tabId`)
//   'tool': a tool call started or ended (`requestId`, `phase`, `name`,
//     `label`, `step`, `error` on a failed call)
//   'message': the model took a step with text before its tool calls
//     (`requestId`, `step`, `text`, raw)
//   'retry': the provider call is retried (`requestId`, `attempt`, `wait`,
//     `step`)
//   'summary': earlier messages are being summarized for the request
//     (`requestId`)
//   'revert': a revert record changed and the chat's revert slot was freed
//     (`revertId`)
//   'revertProgress': a revert finished one more document (`revertId`,
//     `done`, `total`)

const EVENT = 'assistant-chat';

module.exports = (self) => {
  return {
    /**
     * Publishes a change or progress of a chat to every browser tab of its
     * owner. A failure is logged and never fails what it reports on.
     *
     * @param {object} req A request of the chat's owner.
     * @param {string} chatId
     * @param {string} stage
     * @param {object} [data]
     */
    async publish(req, chatId, stage, data = {}) {
      if (!req.user?._id) {
        return;
      }
      try {
        await self.apos.notification.trigger(req, {
          bus: true,
          tab: 'every',
          event: {
            name: EVENT,
            data: {
              chatId,
              stage,
              ...data
            }
          }
        });
      } catch (e) {
        self.logError(req, 'publish', e.message, {
          chatId,
          stage,
          stack: e.stack
        });
      }
    },

    // A chat record changed: its title as stored now
    async publishChat(req, chatId) {
      const stored = await self.chats.findOne({ _id: chatId }, {
        projection: { title: 1 }
      });
      if (stored) {
        await self.publish(req, chatId, 'chat', {
          title: stored.title || null
        });
      }
    },

    // A request record changed: its status as stored now
    async publishRequest(req, request) {
      const stored = await self.requests.findOne({
        _id: request._id,
        ownerId: request.ownerId
      }, {
        projection: {
          status: 1,
          tabId: 1
        }
      });
      if (stored) {
        await self.publish(req, request.chatId, 'request', {
          requestId: request._id,
          status: stored.status,
          tabId: stored.tabId
        });
      }
    },

    // The progress hooks of a request's run. A tool's `label` may be an
    // i18n key
    getProgressHooks(req, request, tools) {
      const labels = new Map(tools.map(tool => [ tool.name, tool.label ]));
      const base = {
        requestId: request._id
      };
      return {
        onToolCall: async ({
          phase, call, step, error
        }) => {
          await self.publish(req, request.chatId, 'tool', {
            ...base,
            phase,
            name: call.name,
            label: labels.get(call.name) || null,
            step,
            ...(error !== undefined && { error })
          });
        },
        onMessage: async (message, { step }) => {
          const text = (message.content || [])
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('')
            .trim();
          if (text) {
            await self.publish(req, request.chatId, 'message', {
              ...base,
              step,
              text
            });
          }
        },
        onRetry: async ({
          attempt, wait, step
        }) => {
          await self.publish(req, request.chatId, 'retry', {
            ...base,
            attempt,
            wait,
            step
          });
        }
      };
    }
  };
};
