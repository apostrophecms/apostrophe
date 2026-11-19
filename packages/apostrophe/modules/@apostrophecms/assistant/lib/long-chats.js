// Long chats. The stored chat stays complete; what a send gives the model
// is measured against a budget and, past the threshold, shortened: the
// results of old reads and old images and documents are replaced by short
// notes (tier 1). What was shortened is a checkpoint on the chat, applied
// whenever the chat is replayed, so a stored part is never rewritten.
//
// A checkpoint: `{ _id, sequence, calls, media, before, after, at }`.
// `sequence` is the request whose send made it; `calls` the tool call ids
// whose results are cleared and `media` the requests whose images and
// documents are dropped, each including the earlier checkpoints'; `before`
// and `after` the measure in tokens.

// Measured on stored chats: about 2.1 characters per token, the ids and
// JSON of tool results tokenizing densely
const CHARS_PER_TOKEN = 2;
// Requests tier 1 leaves whole, the latest ones
const KEEP_REQUESTS = 2;
// The note a cleared read leaves: the model saw the result and acted on
// it, so what it concluded stands
const CLEARED_NOTE = 'This result was read when the call was made and later removed from the ' +
  'chat to save space. What was concluded from it still holds; call the tool again only for ' +
  'detail that is no longer here.';
const MEDIA_TYPES = [ 'image', 'document' ];
const MEDIA_NAMES = {
  image: 'An image',
  document: 'A document'
};

module.exports = (self) => {
  return {
    // The tokens a chat may fill: the lower of `contextLimit` and the
    // window of the model the next send runs on, `contextLimit` alone when
    // the model's window is not known
    getBudget() {
      const { effort, contextLimit } = self.options;
      if (!Object.keys(self.apos.ai.modelCatalog().effort.levels).length) {
        return contextLimit;
      }
      const { contextWindow } = self.apos.ai.modelInfo(effort ? { effort } : {});
      return contextWindow ? Math.min(contextLimit, contextWindow) : contextLimit;
    },

    // The measure past which a send is shortened
    getThreshold() {
      return Math.floor(self.getBudget() * self.options.contextThreshold / 100);
    },

    estimateTokens(value) {
      const chars = (typeof value === 'string') ? value.length : JSON.stringify(value ?? '').length;
      return Math.ceil(chars / CHARS_PER_TOKEN);
    },

    /**
     * What the model reads when `request` is sent, in tokens: the
     * provider's count for the last step of the latest request that has
     * one, or the latest checkpoint's estimate when it was made after that
     * request, plus an estimate of what was added since and the request's
     * own message.
     *
     * @param {object} chat
     * @param {object[]} earlier The replayed requests (`getReplayedRequests`).
     * @param {object} request The request being sent.
     * @returns {number}
     */
    measureSend(chat, earlier, request) {
      const checkpoint = self.getCheckpoint(chat);
      const counted = earlier.findLastIndex(stored => stored.lastStepUsage);
      let base = 0;
      let added;
      if ((counted !== -1) && !(checkpoint?.sequence > earlier[counted].sequence)) {
        const { inputTokens, outputTokens } = earlier[counted].lastStepUsage;
        base = inputTokens + outputTokens;
        // The last step's own reply is in its output; what came after it
        // (results of the calls it made, unanswered calls closed on
        // replay) is not
        const { messages } = earlier[counted];
        const last = messages.findLastIndex(message => message.role === 'assistant');
        added = [
          {
            ...earlier[counted],
            messages: messages.slice(last + 1)
          },
          ...earlier.slice(counted + 1)
        ];
      } else if (checkpoint) {
        base = checkpoint.after;
        added = earlier.filter(stored => stored.sequence >= checkpoint.sequence);
      } else {
        added = earlier;
      }
      return base + self.estimateTokens([
        ...self.applyCheckpoint(checkpoint, added).flatMap(({ messages }) => messages),
        self.getUserMessage(request)
      ]);
    },

    getCheckpoint(chat) {
      return chat.checkpoints?.at(-1) || null;
    },

    /**
     * The replayed requests with what a checkpoint shortened replaced: a
     * cleared read's result by a note naming the call, a dropped image or
     * document by a line saying it was there. Copies; the records are left
     * as they are.
     *
     * @param {object|null} checkpoint
     * @param {object[]} requests Each with its `messages` (and `_id`).
     * @returns {object[]}
     */
    applyCheckpoint(checkpoint, requests) {
      if (!checkpoint) {
        return requests;
      }
      const calls = new Set(checkpoint.calls);
      const media = new Set(checkpoint.media);
      return requests.map(stored => {
        const named = new Map();
        return {
          ...stored,
          messages: stored.messages.map(message => {
            if (!Array.isArray(message.content)) {
              return message;
            }
            return {
              ...message,
              content: message.content.map(part => {
                if (part.type === 'toolCall') {
                  named.set(part.id, part);
                }
                if ((part.type === 'toolResult') && calls.has(part.toolCallId)) {
                  const call = named.get(part.toolCallId);
                  return {
                    ...part,
                    output: {
                      cleared: true,
                      tool: call?.name,
                      input: call?.input,
                      note: CLEARED_NOTE
                    }
                  };
                }
                if (MEDIA_TYPES.includes(part.type) && media.has(stored._id)) {
                  return {
                    type: 'text',
                    text: `[${part.name ? `The ${part.type} "${part.name}"` : MEDIA_NAMES[part.type]} ` +
                      'was shown here and later removed from the chat to save space.]'
                  };
                }
                return part;
              })
            };
          })
        };
      });
    },

    /**
     * Shortens what the send of `request` replays when its measure is past
     * the threshold: the results of `query` tools and the images and
     * documents of every request but the latest `KEEP_REQUESTS` are
     * replaced by notes. Stored as a checkpoint when it clears anything
     * new. Silent: nothing shows in the panel.
     *
     * @param {object} chat
     * @param {object[]} earlier The replayed requests.
     * @param {object} request
     * @returns {Promise<object>} The chat, with the new checkpoint when one
     *   was stored.
     */
    async shortenBeforeSend(chat, earlier, request) {
      const before = self.measureSend(chat, earlier, request);
      if (before <= self.getThreshold()) {
        return chat;
      }
      const checkpoint = self.clearOldReads(chat, earlier, {
        sequence: request.sequence,
        keep: KEEP_REQUESTS,
        before
      });
      if (!checkpoint) {
        return chat;
      }
      const checkpoints = [ ...(chat.checkpoints || []), checkpoint ];
      await self.chats.updateOne({
        _id: chat._id,
        ownerId: chat.ownerId
      }, {
        $set: { checkpoints }
      });
      return {
        ...chat,
        checkpoints
      };
    },

    /**
     * Tier 1: a checkpoint clearing what the latest one hasn't of the
     * `query` results and the images and documents of `requests` but the
     * last `keep`, or null when there is nothing new to clear. `after` is
     * `before` less the estimate of what was cleared.
     *
     * @param {object} chat
     * @param {object[]} requests
     * @param {object} options
     * @param {number} options.sequence The request the checkpoint is made for.
     * @param {number} options.keep
     * @param {number} options.before
     * @returns {object|null}
     */
    clearOldReads(chat, requests, {
      sequence, keep, before
    }) {
      const previous = self.getCheckpoint(chat);
      const calls = new Set(previous?.calls);
      const media = new Set(previous?.media);
      const older = requests.slice(0, Math.max(requests.length - keep, 0));
      const cleared = [];
      const dropped = [];
      for (const stored of older) {
        const named = new Map();
        for (const message of stored.messages) {
          for (const part of Array.isArray(message.content) ? message.content : []) {
            if (part.type === 'toolCall') {
              named.set(part.id, part.name);
            }
            if ((part.type === 'toolResult') && !calls.has(part.toolCallId) &&
              (self.apos.ai.getTool(named.get(part.toolCallId))?.kind === 'query')) {
              calls.add(part.toolCallId);
              cleared.push(part.toolCallId);
            }
            if (MEDIA_TYPES.includes(part.type) && !media.has(stored._id)) {
              media.add(stored._id);
              dropped.push(stored._id);
            }
          }
        }
      }
      if (!cleared.length && !dropped.length) {
        return null;
      }
      const checkpoint = {
        _id: self.apos.util.generateId(),
        sequence,
        calls: [ ...calls ],
        media: [ ...media ],
        before,
        at: new Date()
      };
      const size = list => self.estimateTokens(list.flatMap(({ messages }) => messages));
      const saved = size(self.applyCheckpoint(previous, older)) -
        size(self.applyCheckpoint(checkpoint, older));
      checkpoint.after = Math.max(before - Math.max(saved, 0), 0);
      return checkpoint;
    }
  };
};
