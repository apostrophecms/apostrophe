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
// A chat is shortened again only once it has grown by a step past where
// the last shortening left it. A request that outgrows the budget itself
// gets one harder shortening, and past the budget again it ends: it can't
// fit.
//
// A checkpoint: `{ _id, sequence, calls, media, summary, before, after,
// at, summaries, summaryUsage }`, one per request, the request's latest.
// `sequence` is the request whose send made it; `calls` the tool call ids
// whose results are cleared and `media` the requests whose images and
// documents are dropped, each including the earlier checkpoints';
// `summary` the current summary, its `covers` the last request it
// replaces; `before` and `after` the measure in tokens; `summaries` how
// many summaries the request wrote and `summaryUsage` what they cost.

// Measured on stored chats: about 2.1 characters per token, the ids and
// JSON of tool results tokenizing densely
const CHARS_PER_TOKEN = 2;
// Requests tier 1 leaves whole, the latest ones
const KEEP_REQUESTS = 2;
// Tool rounds of the running request tier 1 leaves whole, the latest ones:
// the last one the model has not read yet
const KEEP_ROUNDS = 2;
// Of the threshold, the step a chat grows by between two shortenings
const STEP_SHARE = 1 / 6;
// The note a cleared read leaves: the model saw the result and acted on
// it, so what it concluded stands
const CLEARED_NOTE = 'This result was read when the call was made and later removed from the ' +
  'chat to save space. What was concluded from it still holds; call the tool again only for ' +
  'detail that is no longer here.';
const MEDIA_TYPES = [ 'image', 'document' ];
// What providers bill for an image at the size the assistant sends, and
// for a PDF page (measured: about 2,370 a page of text); a PDF's pages
// counted by its size when not known
const IMAGE_TOKENS = 1600;
const DOCUMENT_PAGE_TOKENS = 2400;
const DOCUMENT_PAGE_BYTES = 100 * 1024;
// Our projection of the least every send carries before the chat itself:
// the instructions and the tool definitions, on a project with no
// guidance of its own. A project's guidance only adds to it, so a cap
// built on it errs toward taking a file, never refusing one that fits
const MIN_PREFIX_TOKENS = 10000;
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

    // The most pages one PDF may have: what fits under the threshold beside
    // the instructions and tools
    getMaxDocumentPages() {
      const room = self.getThreshold() - MIN_PREFIX_TOKENS;
      return Math.max(Math.floor(room / DOCUMENT_PAGE_TOKENS), 1);
    },

    // What a chat grows by between two shortenings, and how far under the
    // threshold a shortening aims, so the next one breaks the provider's
    // cache only after real growth: a share of the threshold, at most half
    // the room above it
    getStep() {
      const threshold = self.getThreshold();
      const room = self.getBudget() - threshold;
      return Math.floor(Math.min(threshold * STEP_SHARE, room / 2));
    },

    // Whether a chat that measures `before` is shortened now: past the
    // threshold, and grown by a step since its latest checkpoint
    isDue(chat, before) {
      const after = self.getCheckpoint(chat)?.after ?? -Infinity;
      return before > Math.max(self.getThreshold(), after + self.getStep());
    },

    estimateChars(tokens) {
      return tokens * CHARS_PER_TOKEN;
    },

    // An image or a document counts as what a provider bills for it, not
    // as its reference or its base64
    estimateTokens(value) {
      if (typeof value === 'string') {
        return Math.ceil(value.length / CHARS_PER_TOKEN);
      }
      let media = 0;
      const chars = JSON.stringify(value ?? '', (key, item) => {
        if (!isMediaPart(item)) {
          return item;
        }
        if (item.type === 'image') {
          media += IMAGE_TOKENS;
        } else {
          const bytes = (item.document?.data?.length || 0) * 3 / 4;
          media += DOCUMENT_PAGE_TOKENS *
            (item.pages || Math.max(Math.ceil(bytes / DOCUMENT_PAGE_BYTES), 1));
        }
        return null;
      }).length;
      return Math.ceil(chars / CHARS_PER_TOKEN) + media;
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
     * @param {object} [request] The request being sent; without one, what
     *   the next send gives the model before its message.
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
        ...(request ? [ self.getUserMessage(request) ] : [])
      ]);
    },

    /**
     * How long a chat is as the panel's gauge shows it: `measure`, what the
     * next send gives the model before its message, and `threshold`, where
     * shortening starts, both in tokens.
     *
     * @param {object} chat The chat record, its checkpoints included.
     * @returns {Promise<{ measure: number, threshold: number }>}
     */
    async getChatLength(chat) {
      const earlier = await self.getReplayedRequests(chat, { sequence: Infinity });
      return {
        measure: self.measureSend(chat, earlier),
        threshold: self.getThreshold()
      };
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
     * Shortens what the send of `request` replays, due by its measure
     * (`isDue`): the results of `query` tools and the images and documents
     * of every request but the latest `KEEP_REQUESTS` are replaced by
     * notes, and when that leaves the chat less than a step under its
     * threshold, those requests by a summary. Stored as a checkpoint when
     * it changes anything. Silent but for the summary's status line.
     *
     * @param {object} req
     * @param {object} chat
     * @param {object[]} earlier The replayed requests.
     * @param {object} request
     * @param {object} options
     * @param {number} options.before The send's measure (`measureSend`).
     * @param {AbortSignal} [options.signal] Ends a summary being written.
     * @returns {Promise<object>} The chat, with the new checkpoint when one
     *   was stored.
     */
    async shortenBeforeSend(req, chat, earlier, request, { before, signal }) {
      const checkpoint = await self.shorten(req, chat, earlier, {
        sequence: request.sequence,
        keep: KEEP_REQUESTS,
        before,
        request,
        summary: {
          keep: KEEP_REQUESTS,
          signal,
          // The chat as the latest request sent it
          continuation: () => ({
            system: self.getRunInstructions(self.getRunReq(req, chat, request), chat),
            messages: self.buildTranscript(chat, earlier),
            tools: self.getRunTools()
          })
        }
      });
      return checkpoint ? self.storeCheckpoint(chat, checkpoint) : chat;
    },

    /**
     * Called between the steps of a running request, with what its next
     * step would send. Due a shortening (`isDue`), it clears the `query`
     * results of the earlier requests but the latest `KEEP_REQUESTS` and of
     * the request's own tool rounds but the latest `KEEP_ROUNDS`, then,
     * less than a step under the threshold, replaces every earlier request
     * by a summary, and stores the checkpoint. The run then pauses and the
     * request continues on a new run that replays it. Nothing new to
     * shorten leaves the run going.
     *
     * Past the budget it throws `aiContextOverflow`, as a provider does on
     * a prompt too long, and the run ends the same way (`endRun`).
     *
     * @param {object} req The run's `req`.
     * @param {object} chat The chat as the run started on it.
     * @param {object} request
     * @param {object} step
     * @param {object} step.usage The step's own usage.
     * @param {object[]} step.messages The run's transcript so far.
     * @param {number} step.prior Where the request's own part starts in it.
     * @param {string} step.system The run's instructions.
     * @param {string[]} step.tools The run's tool names.
     * @param {AbortSignal} [step.signal] The run's.
     * @returns {Promise<boolean>} Whether the run should pause.
     */
    async shortenInRequest(req, chat, request, {
      usage, messages, prior, system, tools, signal
    }) {
      const before = self.measureStep(usage, messages);
      if (before > self.getBudget()) {
        throw self.apos.error('aiContextOverflow', 'the chat is past its budget');
      }
      // A checkpoint ends the run, so the chat's latest is the one the run
      // started on
      if (!self.isDue(chat, before)) {
        return false;
      }
      return Boolean(await self.shortenRequest(req, request, messages.slice(prior), {
        before,
        keep: KEEP_REQUESTS,
        keepRounds: KEEP_ROUNDS,
        summary: {
          keep: 0,
          signal,
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
     * is still less than a step under its threshold. The checkpoint, or
     * null when nothing new was shortened.
     *
     * @param {object} req
     * @param {object} request
     * @param {object[]} own The request's part of the transcript, as its run
     *   read it.
     * @param {object} options
     * @param {number} options.before The measure, in tokens.
     * @param {number} options.keep
     * @param {number} options.keepRounds
     * @param {object} [options.summary] `{ keep, continuation, signal }`,
     *   as `shorten` takes it.
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
     * Tier 1, then tier 2 when tier 1 leaves the measure less than a step
     * under the threshold: the earlier requests the current summary doesn't
     * cover, but the last `summary.keep`, summarized as tier 1 leaves them,
     * the current summary folded in. A request whose summary failed gets no
     * second one. The new checkpoint, not stored, or null when nothing new
     * was shortened.
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
     *   requests it leaves out, `continuation`, a function returning the
     *   chat as last sent (`writeSummary`), absent when that can't be sent
     *   again, and `signal`, which ends a summary being written.
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
      const aim = self.getThreshold() - self.getStep();
      if (!summary || ((checkpoint?.after ?? before) <= aim)) {
        return checkpoint;
      }
      const covers = previous?.summary?.covers ?? -1;
      const open = earlier.filter(stored => stored.sequence > covers);
      const requests = open.slice(0, Math.max(open.length - summary.keep, 0));
      const asked = {
        _id: request._id,
        ownerId: request.ownerId
      };
      if (!requests.length) {
        return checkpoint;
      }
      const { summaryFailed } = await self.requests.findOne(asked, {
        projection: { summaryFailed: 1 }
      });
      if (summaryFailed) {
        return checkpoint;
      }
      const cleared = checkpoint || previous;
      const written = await self.writeSummary(req, chat, {
        requests: self.applyCheckpoint(cleared && {
          calls: cleared.calls,
          media: cleared.media
        }, requests),
        // A continued chat's first summary folds in the one it carried over
        previous: previous?.summary || chat.carried?.summary || null,
        continuation: summary.continuation?.(),
        request,
        signal: summary.signal
      });
      if (!written) {
        if (!summary.signal?.aborted) {
          await self.requests.updateOne(asked, { $set: { summaryFailed: true } });
        }
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
        before - self.getReplaySize(previous, all, chat) +
          self.getReplaySize(checkpoint, all, chat),
        0
      );
      return checkpoint;
    },

    // What a checkpoint leaves of the requests and its summary, in tokens
    getReplaySize(checkpoint, requests, chat) {
      const replayed = self.applyCheckpoint(checkpoint, requests)
        .flatMap(({ messages }) => messages);
      return self.estimateTokens([ replayed, self.getSummarySection(checkpoint, chat) ]);
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

    // Stores a checkpoint on the chat, in place of an earlier one of the
    // same request: a revert falls back by request, so its latest is all
    // a request needs. The chat with it
    async storeCheckpoint(chat, checkpoint) {
      const stored = chat.checkpoints || [];
      const last = stored.at(-1);
      const same = (last?.sequence === checkpoint.sequence) ? last : null;
      const usage = { ...same?.summaryUsage };
      for (const [ key, value ] of Object.entries(checkpoint.summaryUsage || {})) {
        usage[key] = (usage[key] || 0) + value;
      }
      const checkpoints = [
        ...(same ? stored.slice(0, -1) : stored),
        {
          ...checkpoint,
          ...(same && { _id: same._id }),
          summaries: (same?.summaries || 0) + (checkpoint.summaryUsage ? 1 : 0),
          ...(Object.keys(usage).length && { summaryUsage: usage })
        }
      ];
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

// A content part carrying an image or a document, or naming a chat file
// for one: not a widget or a document whose type is called `image`
function isMediaPart(item) {
  return Boolean(item) && (typeof item === 'object') && MEDIA_TYPES.includes(item.type) &&
    ((typeof item.attachmentId === 'string') || (typeof item.image?.data === 'string') ||
      (typeof item.image?.url === 'string') || (typeof item.document?.data === 'string'));
}
