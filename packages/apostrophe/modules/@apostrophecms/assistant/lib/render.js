// Requests and reverts as the panel reads them, built on every read and
// never stored: a request's reply rendered, the steps the run took (each
// step's arguments and result read on their own), and the documents it had
// to leave because someone was editing them; a revert's documents without
// their rows.

const DOOR = 'assistant';
// A step's arguments and result are a trail, not a reader: a document read
// can run to tens of thousands of characters
const STEP_TEXT_MAX = 2000;

module.exports = (self) => {
  // A request's tool calls in order, each with its arguments and its result
  // or error as the transcript holds them
  function readSteps(messages) {
    const labels = new Map(self.apos.harness.getDoorTools(DOOR)
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

  function toText(value) {
    const text = (typeof value === 'string') ? value : JSON.stringify(value, null, 2);
    if (!text || (text.length <= STEP_TEXT_MAX)) {
      return text || null;
    }
    return `${text.slice(0, STEP_TEXT_MAX)}\n…`;
  }

  return {
    /**
     * A request as the panel reads it: what the thread shows, never the
     * transcript. Its message stays as typed, which the panel shows with its
     * checked `mentions` as chips; `reply` is the run's last words to the
     * editor, rendered, the documents it names chips (`null` before it has
     * any); `steps` lists the tool calls in order, `{ id, name, label }`,
     * whose arguments and result are read one step at a time
     * (`renderStep`); `locked` lists the documents a write was refused for a
     * lock and no later write of the request reached, `{ _id, title,
     * lockedBy }`, `lockedBy` the holder's name, `null` for the editor's own
     * other browser tab or chat. The vendor and model are left out unless
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
        schemaVersion, ...rest
      } = request;
      return {
        ...rest,
        // A result an ask keeps for the model is not the panel's
        ...(rest.asks && {
          asks: rest.asks.map(({ result, ...ask }) => ask)
        }),
        ...(self.options.modelDisplay && {
          provider,
          model
        }),
        reply: getReply(),
        steps: readSteps(messages).map(({
          id, name, label
        }) => ({
          id,
          name,
          label
        })),
        locked: getLocked(),
        // What the agent tools spent counts with the run's own
        ...(agentUsage && { usage: getUsage() })
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
     * One step of a request as the panel reads it once the editor opens it:
     * `{ input, output, error }`, the arguments and the result or error as
     * capped JSON text, `null` where there is none yet. `null` when the
     * request has no such step.
     *
     * @param {object} request
     * @param {string} stepId The tool call's id.
     * @returns {object|null}
     */
    renderStep(request, stepId) {
      const step = readSteps(request.messages || []).find(each => each.id === stepId);
      if (!step) {
        return null;
      }
      return {
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
