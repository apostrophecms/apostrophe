// Long chats. The stored chat stays complete; what a send gives the model
// is measured against a budget and, past the threshold, shortened: the
// results of old reads and old images and documents are replaced by short
// notes (tier 1). What was shortened is a checkpoint on the chat, applied
// whenever the chat is replayed, so a stored part is never rewritten.
// Inside a running request the between-steps hook does the same: the run
// pauses, its own older reads are cleared too, and the request continues in
// a new run.
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
// Tool rounds of the running request tier 1 leaves whole, the latest ones:
// the last one the model has not read yet
const KEEP_ROUNDS = 2;
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

    // What the model reads at the next step of a running request: the
    // provider's count for the step just made plus an estimate of the
    // results its tool calls added
    measureStep(usage, messages) {
      const last = messages.findLastIndex(message => message.role === 'assistant');
      return usage.inputTokens + usage.outputTokens +
        self.estimateTokens(messages.slice(last + 1));
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
      return checkpoint ? self.storeCheckpoint(chat, checkpoint) : chat;
    },

    /**
     * Called between the steps of a running request: past the threshold,
     * clears the `query` results of the earlier requests but the latest
     * `KEEP_REQUESTS` and of the request's own tool rounds but the latest
     * `KEEP_ROUNDS`, and stores the checkpoint. The run then pauses and the
     * request continues on a new run that replays it. Nothing new to clear
     * leaves the run going.
     *
     * @param {object} request
     * @param {object} step
     * @param {object} step.usage The step's own usage.
     * @param {object[]} step.messages The run's transcript so far.
     * @param {number} step.prior Where the request's own part starts in it.
     * @returns {Promise<boolean>} Whether the run should pause.
     */
    async shortenInRequest(request, {
      usage, messages, prior
    }) {
      const before = self.measureStep(usage, messages);
      if (before <= self.getThreshold()) {
        return false;
      }
      return Boolean(await self.shortenRequest(request, messages.slice(prior), {
        before,
        keep: KEEP_REQUESTS,
        keepRounds: KEEP_ROUNDS
      }));
    },

    /**
     * Shortens what a request's next run replays and stores the checkpoint:
     * the `query` results and images and documents of the earlier requests
     * but the latest `keep`, and the `query` results of the request's own
     * tool rounds but the latest `keepRounds`. The checkpoint, or null when
     * nothing new was cleared.
     *
     * @param {object} request
     * @param {object[]} own The request's part of the transcript, as its run
     *   read it.
     * @param {object} options
     * @param {number} options.before The measure, in tokens.
     * @param {number} options.keep
     * @param {number} options.keepRounds
     * @returns {Promise<object|null>}
     */
    async shortenRequest(request, own, {
      before, keep, keepRounds
    }) {
      const chat = await self.chats.findOne({
        _id: request.chatId,
        ownerId: request.ownerId
      });
      const earlier = await self.getReplayedRequests(chat, request);
      const checkpoint = self.clearOldReads(chat, earlier, {
        sequence: request.sequence,
        keep,
        before,
        current: {
          _id: request._id,
          messages: own,
          keepRounds
        }
      });
      if (checkpoint) {
        await self.storeCheckpoint(chat, checkpoint);
      }
      return checkpoint;
    },

    // Adds a checkpoint to the chat; the chat with it
    async storeCheckpoint(chat, checkpoint) {
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
     * last `keep`, and of the `query` results of a running request's own
     * tool rounds but its last `keepRounds`; null when there is nothing new
     * to clear. `after` is `before` less the estimate of what was cleared.
     *
     * @param {object} chat
     * @param {object[]} requests
     * @param {object} options
     * @param {number} options.sequence The request the checkpoint is made for.
     * @param {number} options.keep
     * @param {number} options.before
     * @param {object} [options.current] The running request: `{ _id,
     *   messages, keepRounds }`, its images and documents left alone.
     * @returns {object|null}
     */
    clearOldReads(chat, requests, {
      sequence, keep, before, current
    }) {
      const previous = self.getCheckpoint(chat);
      const calls = new Set(previous?.calls);
      const media = new Set(previous?.media);
      const older = requests.slice(0, Math.max(requests.length - keep, 0));
      if (current) {
        // Up to the latest `keepRounds` tool messages, the calls they
        // answer with them
        const rounds = current.messages
          .map((message, index) => ((message.role === 'tool') ? index : -1))
          .filter(index => index !== -1);
        const end = (rounds.length > current.keepRounds)
          ? rounds.at(-current.keepRounds - 1) + 1
          : 0;
        older.push({
          _id: current._id,
          messages: current.messages.slice(0, end),
          running: true
        });
      }
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
            if (MEDIA_TYPES.includes(part.type) && !stored.running &&
              !media.has(stored._id)) {
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
