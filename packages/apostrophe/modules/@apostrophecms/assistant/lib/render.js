// Requests and reverts as the panel reads them, built on every read and
// never stored: a request's reply rendered, the steps the run took (each
// step's arguments and result read on their own), and the documents it had
// to leave because someone was editing them; a revert's documents without
// their rows.

const DOOR = 'assistant';
// A step's arguments and result are a trail, not a reader: a document read
// can run to tens of thousands of characters
const STEP_TEXT_MAX = 2000;
// A step's summary is a short list: a write over many documents names the
// first ones and counts the rest
const SUMMARY_MAX = 20;
const SUMMARY_TEXT_MAX = 200;
// The panel suggests continuing in a new chat after this many summaries,
// and again after as many more
const SUGGEST_EVERY = 3;

module.exports = (self) => {
  // A request's tool calls in order, each with its arguments and its result
  // or error as the transcript holds them
  function readSteps(messages) {
    const labels = new Map(self.apos.aposHarness.getDoorTools(DOOR)
      .map(tool => [ tool.name, tool.label ]));
    const steps = [];
    const byId = new Map();
    for (const part of messages.flatMap(message => message.content || [])) {
      if (part.type === 'toolCall') {
        const step = {
          id: part.id,
          name: part.name,
          label: labels.get(part.name) || null,
          input: part.input
        };
        steps.push(step);
        byId.set(part.id, step);
      } else if (part.type === 'toolResult') {
        const step = byId.get(part.toolCallId);
        if (!step) {
          continue;
        }
        if (part.error !== undefined) {
          step.error = part.error;
        } else {
          step.output = part.output;
        }
      }
    }
    return steps;
  }

  // What happened in a step, as its tool's `summary` tells it; nothing
  // without one. A call refused for its arguments keeps them as the model
  // gave them: a summary that can't be told doesn't stop the step opening
  function getStepSummary(step) {
    const tool = self.apos.ai.getTools().find(each => each.name === step.name);
    if (!tool?.summary) {
      return [];
    }
    try {
      return (tool.summary(step.input || {}, step.output || null) || []).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  // Whether a step has something to show in its summary: what happened, or
  // that it failed. Told from the transcript alone: a document named by id
  // counts, though one nobody can read is left out when the step opens
  function isListed(step) {
    return ('error' in step) || getStepSummary(step).some(item =>
      [ item._id, item.title, item.type ].some(value => typeof value === 'string') ||
        ((typeof item.text === 'string') && Boolean(item.text.trim())));
  }

  // A step's summary as the panel shows it, each item one of:
  // - `{ kind: 'text', text, title, type, localeLabel }`: an i18n key or
  //   plain text the panel translates with `title`, `type` (a type's label)
  //   and `locale` (`localeLabel`, the label of the item's `locale`);
  // - `{ kind: 'document', title, action, count, reason, locale,
  //   localeLabel }`: the title read from the document `req` can see when
  //   the step lacks it, the item left out otherwise; `localeLabel` names
  //   `toLocale`, else the document's locale;
  // - `{ kind: 'type', type, action }`, `type` the type's label as written.
  // A missing value is `null`. An item listed twice is listed once
  async function presentStepSummary(req, items) {
    const presented = [];
    const seen = new Set();
    for (const item of items) {
      const action = (typeof item.action === 'string') ? item.action : null;
      let shown = null;
      if ((typeof item.text === 'string') && item.text.trim()) {
        shown = {
          kind: 'text',
          text: cap(item.text.trim()),
          title: (typeof item.title === 'string') ? cap(item.title) : null,
          type: (typeof item.type === 'string') ? getTypeLabel(item.type) : null,
          localeLabel: (typeof item.locale === 'string') ? getLocaleLabel(item.locale) : null
        };
      } else if ((typeof item._id === 'string') || (typeof item.title === 'string')) {
        const document = await presentDocument(req, item);
        shown = document && {
          kind: 'document',
          title: document.title,
          action,
          count: Number.isInteger(item.count) ? item.count : null,
          reason: (typeof item.reason === 'string') ? item.reason : null,
          locale: document.locale,
          localeLabel: getLocaleLabel(item.toLocale || document.locale),
          key: document.key
        };
      } else if (typeof item.type === 'string') {
        shown = {
          kind: 'type',
          type: getTypeLabel(item.type),
          action
        };
      }
      if (!shown) {
        continue;
      }
      const { key, ...rest } = shown;
      const seenKey = JSON.stringify([ action, key || rest ]);
      if (!seen.has(seenKey)) {
        seen.add(seenKey);
        presented.push(rest);
      }
    }
    return presented;
  }

  function cap(text) {
    return (text.length > SUMMARY_TEXT_MAX) ? `${text.slice(0, SUMMARY_TEXT_MAX)}…` : text;
  }

  // `key` tells one document in one locale from another
  async function presentDocument(req, {
    _id, title, locale
  }) {
    if ((typeof title === 'string') && title) {
      const [ aposDocId, idLocale ] = (_id || '').split(':');
      const shown = locale || idLocale || null;
      return {
        key: `${aposDocId || title}:${shown}`,
        title,
        locale: shown
      };
    }
    if (typeof _id !== 'string') {
      return null;
    }
    try {
      const { doc } = await self.apos.aposHarness.findDraft(req, _id);
      const shown = doc.aposLocale?.split(':')[0] || null;
      return {
        key: `${doc.aposDocId}:${shown}`,
        title: doc.title,
        locale: shown
      };
    } catch (e) {
      if (e.name !== 'notfound') {
        throw e;
      }
      return null;
    }
  }

  function getTypeLabel(type) {
    return self.apos.aposHarness.getTypeOptions(type).label || type;
  }

  function getLocaleLabel(locale) {
    return (locale && self.apos.i18n.locales[locale]?.label) || locale || null;
  }

  function toText(value) {
    const text = (typeof value === 'string') ? value : JSON.stringify(value, null, 2);
    if (!text || (text.length <= STEP_TEXT_MAX)) {
      return text || null;
    }
    return `${text.slice(0, STEP_TEXT_MAX)}\n…`;
  }

  // A summary as the panel shows it: the editor's standing instructions,
  // their own words. The other sections are the model's working notes
  function previewSummary(summary) {
    return summary
      ? { instructions: summary.instructions || [] }
      : null;
  }

  // Continue in a new chat is suggested under the request that wrote
  // every third summary, until dismissed
  function getSuggestion(chat) {
    const written = (chat.checkpoints || []).filter(each => each.summaries);
    const last = written.at(-1);
    const count = written.reduce((sum, each) => sum + each.summaries, 0);
    const reached = Math.floor(count / SUGGEST_EVERY) >
      Math.floor((count - (last?.summaries || 0)) / SUGGEST_EVERY);
    if (!reached || (chat.dismissedSuggestion === last._id)) {
      return null;
    }
    return {
      _id: last._id,
      sequence: last.sequence
    };
  }

  return {
    /**
     * A chat as the panel reads it, without what it saw of each document,
     * what its checkpoints shortened and the summary it carried over as
     * the model reads it. A read of the chat's thread adds `summary`, the
     * current summary's standing instructions and `covers`, the last
     * request it covers; `carriedSummary`, the same of the summary a
     * continued chat carried over; `suggestion`, `{ _id, sequence }` when
     * continuing in a new chat is suggested under that request; and, when
     * given, `length` for the gauge (`getChatLength`). The chat list reads
     * none of them, and the panel keeps the ones it has.
     *
     * @param {object} chat The chat record.
     * @param {object} [options]
     * @param {boolean} [options.thread] Add what the thread shows.
     * @param {object} [options.length]
     * @returns {object}
     */
    renderChat(chat, { thread = false, length = null } = {}) {
      const {
        seen, checkpoints, carried, dismissedSuggestion, ...rest
      } = chat;
      if (!thread) {
        return rest;
      }
      const summary = self.getCheckpoint(chat)?.summary;
      return {
        ...rest,
        summary: summary
          ? {
            ...previewSummary(summary),
            covers: summary.covers
          }
          : null,
        carriedSummary: previewSummary(carried?.summary),
        suggestion: getSuggestion(chat),
        ...(length && { length })
      };
    },

    /**
     * A request as the panel reads it: what the thread shows, never the
     * transcript. Its message stays as typed, which the panel shows with its
     * checked `mentions` as chips; `reply` is the run's last words to the
     * editor, rendered, the documents it names chips (`null` before it has
     * any); `steps` lists the tool calls in order, `{ id, name, label,
     * listed }`, `listed` when it has a summary to show (what happened, or
     * that it failed), each step's details read on their own
     * (`renderStep`); `locked` lists the documents a write was refused for a
     * lock and no later write of the request reached, `{ _id, title,
     * lockedBy }`, `lockedBy` the holder's name, `null` for the editor's own
     * other browser tab or chat; `notices` the messages its tools posted
     * (see notices.js), each `action` without its data, `null` once run.
     * The vendor and model are left out unless
     * `modelDisplay` is set, and the screen it was sent with and what the
     * model was told of its changes to the page always. `usage` includes
     * what the agent tools spent.
     *
     * @param {object} request
     * @returns {object}
     */
    renderRequest(request) {
      const {
        provider, model, pageChanges, pageRows, agentUsage, messages = [],
        replyMentions, screen, screenChanged, prior, jobId, ownerId,
        schemaVersion, takenActions, ...rest
      } = request;
      return {
        ...rest,
        // A result an ask keeps for the model is not the panel's
        ...(rest.asks && {
          asks: rest.asks.map(({ result, ...ask }) => ask)
        }),
        // An action's data is the server's, and an action runs once
        ...(rest.notices && {
          notices: rest.notices.map(notice => ({
            ...notice,
            action: (notice.action && !(takenActions || []).includes(notice._id))
              ? {
                name: notice.action.name,
                label: notice.action.label
              }
              : null
          }))
        }),
        ...(self.options.modelDisplay && {
          provider,
          model
        }),
        reply: getReply(),
        steps: readSteps(messages).map(step => ({
          id: step.id,
          name: step.name,
          label: step.label,
          listed: isListed(step)
        })),
        locked: getLocked(),
        // What the agent tools spent counts with the run's own
        ...(Object.keys(agentUsage || {}).length && { usage: getUsage() })
      };

      function getReply() {
        for (const message of messages.toReversed()) {
          if (message.role !== 'assistant') {
            continue;
          }
          const text = (message.content || [])
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('')
            .trim();
          if (text) {
            return self.renderMarkdown(text, { mentions: replyMentions });
          }
        }
        return null;
      }

      function getUsage() {
        const usage = { ...rest.usage };
        for (const [ key, value ] of Object.entries(agentUsage)) {
          usage[key] = (usage[key] || 0) + value;
        }
        return usage;
      }

      // In the harness's write result, a document is `written` or `refused`
      function getLocked() {
        const locked = new Map();
        for (const part of messages.flatMap(message => message.content || [])) {
          if (part.type !== 'toolResult') {
            continue;
          }
          for (const item of part.output?.written || []) {
            locked.delete(item._id);
          }
          for (const item of part.output?.refused || []) {
            if (item.reason === 'locked') {
              locked.set(item._id, {
                _id: item._id,
                title: item.title || null,
                lockedBy: item.lockedBy || null
              });
            }
          }
        }
        return [ ...locked.values() ];
      }
    },

    /**
     * Requests as a route answers with them: as `renderRequest` renders
     * each, with `unavailable`, the ids of the chat files it names that are
     * no longer stored (its attachments, the images its image asks kept),
     * which the thread shows as no longer available.
     *
     * @param {object[]} requests
     * @returns {Promise<object[]>}
     */
    async presentRequests(requests) {
      const named = requests.map(request => [
        ...(request.attachments || []).map(attachment => attachment._id),
        ...(request.imageAsks || []).flatMap(ask => [
          ...ask.rounds.map(round => round.kept),
          ask.outcome?.attachmentId
        ])
      ].filter(Boolean));
      const ids = [ ...new Set(named.flat()) ];
      const stored = new Set(ids.length
        ? (await self.attachments.find({
          _id: { $in: ids },
          status: 'stored'
        }, { projection: { _id: 1 } }).toArray()).map(record => record._id)
        : []);
      return requests.map((request, i) => ({
        ...self.renderRequest(request),
        unavailable: named[i].filter(_id => !stored.has(_id))
      }));
    },

    // One request as a route answers with it (see `presentRequests`)
    async presentRequest(request) {
      return (await self.presentRequests([ request ]))[0];
    },

    /**
     * One step of a request as the panel reads it once the editor opens it:
     * `summary`, what happened (see `presentStepSummary` above), at most
     * `SUMMARY_MAX` items, with `more`, the count left out; `failed` when it
     * ended in an error; and `{ input, output, error }`, the arguments and
     * the result or error as capped JSON text, `null` where there is none
     * yet, which the panel shows under `stepDisplay` 'data' or 'all'. `null`
     * when the request has no such step.
     *
     * @param {object} req The editor reading it.
     * @param {object} request
     * @param {string} stepId The tool call's id.
     * @returns {Promise<object|null>}
     */
    async renderStep(req, request, stepId) {
      const step = readSteps(request.messages || []).find(each => each.id === stepId);
      if (!step) {
        return null;
      }
      const summary = await presentStepSummary(req, getStepSummary(step));
      return {
        summary: summary.slice(0, SUMMARY_MAX),
        more: Math.max(0, summary.length - SUMMARY_MAX),
        failed: 'error' in step,
        input: toText(step.input),
        output: ('output' in step) ? toText(step.output) : null,
        error: ('error' in step) ? toText(step.error) : null
      };
    },

    /**
     * A revert, or a revert's dry run, as the panel reads it: each document
     * without its rows, `partly` when it is kept or not restorable though
     * some of its rows were put back, with its type's `label` and
     * `pluralLabel` as written.
     *
     * @param {object} revert
     * @returns {object}
     */
    renderRevert(revert) {
      const {
        ownerId, schemaVersion, jobId, documents, ...rest
      } = revert;
      return {
        ...rest,
        documents: (documents || []).map(({
          rows, createdRows, ...document
        }) => {
          const manager = self.apos.doc.getManager(document.type);
          const page = manager && self.apos.instanceOf(manager, '@apostrophecms/page-type');
          return {
            ...document,
            label: page ? 'apostrophe:page' : (manager?.options.label || null),
            pluralLabel: page ? 'apostrophe:pages' : (manager?.options.pluralLabel || null),
            partly: [ 'kept', 'unrestorable' ].includes(document.outcome) &&
              (rows || []).some(row => row.outcome === 'putBack')
          };
        })
      };
    }
  };
};
