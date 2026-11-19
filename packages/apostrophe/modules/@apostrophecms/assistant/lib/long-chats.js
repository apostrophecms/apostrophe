// Long chats. The stored chat stays complete; what a send gives the model
// is measured against a budget and, past the threshold, shortened: the
// results of old reads and old images and documents are replaced by short
// notes (tier 1). What was shortened is a checkpoint on the chat, applied
// whenever the chat is replayed, so a stored part is never rewritten.
// Inside a running request the between-steps hook does the same: the run
// pauses, its own older reads are cleared too, and the request continues in
// a new run.
//
// When that is not enough, the older requests are replaced by a summary
// (tier 2, `summaries.js`), which the instructions carry and every later
// checkpoint keeps until a new summary folds it in.
//
// A checkpoint: `{ _id, sequence, calls, media, summary, before, after,
// at }`. `sequence` is the request whose send made it; `calls` the tool
// call ids whose results are cleared and `media` the requests whose images
// and documents are dropped, each including the earlier checkpoints';
// `summary` the current summary, its `covers` the last request it
// replaces; `before` and `after` the measure in tokens. The checkpoint
// that wrote its summary has the summary's `summaryUsage`.

// Measured on stored chats: about 2.1 characters per token, the ids and
// JSON of tool results tokenizing densely
const CHARS_PER_TOKEN = 2;
// Requests tier 1 leaves whole, the latest ones
const KEEP_REQUESTS = 2;
// Tool rounds of the running request tier 1 leaves whole, the latest ones:
// the last one the model has not read yet
const KEEP_ROUNDS = 2;
// Of the budget, what shortening aims to get under: well below the
// threshold, so a shortened chat runs many requests before the next pass
// breaks the provider's cache again
const TARGET_SHARE = 0.5;
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
    // window of the model the next send runs on (or the given effort
    // route's), `contextLimit` alone when the model's window is not known
    getBudget(effort = self.options.effort) {
      const { contextLimit } = self.options;
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

    // The measure shortening aims to get under
    getTarget() {
      return Math.floor(self.getBudget() * TARGET_SHARE);
    },

    estimateChars(tokens) {
      return tokens * CHARS_PER_TOKEN;
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
     * The replayed requests with what a checkpoint shortened replaced: the
     * requests its summary covers left out, a cleared read's result by a
     * note naming the call, a dropped image or document by a line saying
     * it was there. Copies; the records are left as they are.
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
      const covers = checkpoint.summary?.covers ?? -1;
      return requests.filter(stored => !(stored.sequence <= covers)).map(stored => {
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
     * replaced by notes, and when that leaves the chat over the target,
     * those requests by a summary. Stored as a checkpoint when it changes
     * anything. Silent but for the summary's status line.
     *
     * @param {object} req
     * @param {object} chat
     * @param {object[]} earlier The replayed requests.
     * @param {object} request
     * @returns {Promise<object>} The chat, with the new checkpoint when one
     *   was stored.
     */
    async shortenBeforeSend(req, chat, earlier, request) {
      const before = self.measureSend(chat, earlier, request);
      if (before <= self.getThreshold()) {
        return chat;
      }
      const checkpoint = await self.shorten(req, chat, earlier, {
        sequence: request.sequence,
        keep: KEEP_REQUESTS,
        before,
        request,
        summary: {
          keep: KEEP_REQUESTS,
          // The chat as the latest request sent it
          continuation: () => ({
            system: self.getRunInstructions(
              self.getRunReq(req, chat, request),
              self.getCheckpoint(chat)
            ),
            messages: self.buildTranscript(chat, earlier),
            tools: self.getRunTools()
          })
        }
      });
      return checkpoint ? self.storeCheckpoint(chat, checkpoint) : chat;
    },

    /**
     * Called between the steps of a running request: past the threshold,
     * clears the `query` results of the earlier requests but the latest
     * `KEEP_REQUESTS` and of the request's own tool rounds but the latest
     * `KEEP_ROUNDS`, then, still over the target, replaces every earlier
     * request by a summary, and stores the checkpoint. The run then pauses
     * and the request continues on a new run that replays it. Nothing new
     * to shorten leaves the run going.
     *
     * @param {object} req The run's `req`.
     * @param {object} request
     * @param {object} step
     * @param {object} step.usage The step's own usage.
     * @param {object[]} step.messages The run's transcript so far.
     * @param {number} step.prior Where the request's own part starts in it.
     * @param {string} step.system The run's instructions.
     * @param {string[]} step.tools The run's tool names.
     * @returns {Promise<boolean>} Whether the run should pause.
     */
    async shortenInRequest(req, request, {
      usage, messages, prior, system, tools
    }) {
      const before = self.measureStep(usage, messages);
      if (before <= self.getThreshold()) {
        return false;
      }
      return Boolean(await self.shortenRequest(req, request, messages.slice(prior), {
        before,
        keep: KEEP_REQUESTS,
        keepRounds: KEEP_ROUNDS,
        summary: {
          keep: 0,
          continuation: () => ({
            system,
            messages,
            tools
          })
        }
      }));
    },

    /**
     * Shortens what a request's next run replays and stores the checkpoint:
     * the `query` results and images and documents of the earlier requests
     * but the latest `keep`, and the `query` results of the request's own
     * tool rounds but the latest `keepRounds`; with `summary`, then the
     * earlier requests but its `keep` replaced by a summary when the chat
     * is still over the target. The checkpoint, or null when nothing new
     * was shortened.
     *
     * @param {object} req
     * @param {object} request
     * @param {object[]} own The request's part of the transcript, as its run
     *   read it.
     * @param {object} options
     * @param {number} options.before The measure, in tokens.
     * @param {number} options.keep
     * @param {number} options.keepRounds
     * @param {object} [options.summary] `{ keep, continuation }`, as
     *   `shorten` takes it.
     * @returns {Promise<object|null>}
     */
    async shortenRequest(req, request, own, {
      before, keep, keepRounds, summary
    }) {
      const chat = await self.chats.findOne({
        _id: request.chatId,
        ownerId: request.ownerId
      });
      const earlier = await self.getReplayedRequests(chat, request);
      const checkpoint = await self.shorten(req, chat, earlier, {
        sequence: request.sequence,
        keep,
        before,
        request,
        current: {
          _id: request._id,
          messages: own,
          keepRounds
        },
        summary
      });
      if (checkpoint) {
        await self.storeCheckpoint(chat, checkpoint);
      }
      return checkpoint;
    },

    /**
     * Tier 1, then tier 2 when tier 1 leaves the measure over the target:
     * the earlier requests the current summary doesn't cover, but the last
     * `summary.keep`, summarized, the current summary folded in. The new
     * checkpoint, not stored, or null when nothing new was shortened.
     *
     * @param {object} req
     * @param {object} chat
     * @param {object[]} earlier The replayed requests, stored.
     * @param {object} options
     * @param {number} options.sequence
     * @param {number} options.keep Requests tier 1 leaves whole.
     * @param {number} options.before
     * @param {object} options.request The request shortening runs for.
     * @param {object} [options.current] The running request, as
     *   `clearOldReads` takes it.
     * @param {object} [options.summary] Tier 2 may run: `keep`, the
     *   requests it leaves out, and `continuation`, a function returning
     *   the chat as last sent (`writeSummary`), absent when that can't be
     *   sent again.
     * @returns {Promise<object|null>}
     */
    async shorten(req, chat, earlier, {
      sequence, keep, before, request, current, summary
    }) {
      const previous = self.getCheckpoint(chat);
      let checkpoint = self.clearOldReads(chat, earlier, {
        sequence,
        keep,
        before,
        current
      });
      if (!summary || ((checkpoint?.after ?? before) <= self.getTarget())) {
        return checkpoint;
      }
      const covers = previous?.summary?.covers ?? -1;
      const open = earlier.filter(stored => stored.sequence > covers);
      const requests = open.slice(0, Math.max(open.length - summary.keep, 0));
      if (!requests.length) {
        return checkpoint;
      }
      const written = await self.writeSummary(req, chat, {
        requests,
        previous: previous?.summary || null,
        continuation: summary.continuation?.(),
        request
      });
      if (!written) {
        return checkpoint;
      }
      checkpoint = {
        ...(checkpoint || {
          _id: self.apos.util.generateId(),
          sequence,
          calls: previous?.calls || [],
          media: previous?.media || [],
          before,
          at: new Date()
        }),
        summary: written.summary,
        summaryUsage: written.usage
      };
      const all = [
        ...earlier,
        ...(current
          ? [ {
            _id: current._id,
            messages: current.messages
          } ]
          : [])
      ];
      checkpoint.after = Math.max(
        before - self.getReplaySize(previous, all) + self.getReplaySize(checkpoint, all),
        0
      );
      return checkpoint;
    },

    // What a checkpoint leaves of the requests and its summary, in tokens
    getReplaySize(checkpoint, requests) {
      const replayed = self.applyCheckpoint(checkpoint, requests)
        .flatMap(({ messages }) => messages);
      return self.estimateTokens([ replayed, self.getSummarySection(checkpoint) ]);
    },

    // A revert takes back what the checkpoints made at or after its first
    // request shortened, summaries covering reverted work included: replay
    // falls back to the checkpoint before them, or to the whole chat
    async discardCheckpoints(chat, sequence) {
      const stored = await self.chats.findOne({
        _id: chat._id,
        ownerId: chat.ownerId
      }, { projection: { checkpoints: 1 } });
      const checkpoints = stored?.checkpoints || [];
      const kept = checkpoints.filter(checkpoint => checkpoint.sequence < sequence);
      if (kept.length === checkpoints.length) {
        return;
      }
      await self.chats.updateOne({
        _id: chat._id,
        ownerId: chat.ownerId
      }, {
        $set: { checkpoints: kept }
      });
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
     * `query` results and the images and documents of `requests` its
     * summary doesn't cover but the last `keep`, and of the `query` results
     * of a running request's own tool rounds but its last `keepRounds`;
     * null when there is nothing new to clear. It keeps the current
     * summary. `after` is `before` less the estimate of what was cleared.
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
      const covers = previous?.summary?.covers ?? -1;
      const open = requests.filter(stored => stored.sequence > covers);
      const older = open.slice(0, Math.max(open.length - keep, 0));
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
        ...(previous?.summary && { summary: previous.summary }),
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
