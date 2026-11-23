// Approval gates: checks that make the run ask the editor before a tool
// runs. A gate is a tool name and a predicate on the call's validated
// arguments. When one fires, the call suspends with a `confirm` ask stating
// the action and the count, and runs once approved; declined, it writes
// nothing and the model hears so. A gate may word its own confirmation and
// offer alternatives, each a decline that tells the model what to do
// instead. Gates are the assistant's: the harness's tools never ask, and the
// MCP door has none.
//
// One gate ships on every write tool (an action tagged `content`): it fires
// when one call would change more documents than `maxDocsWithoutConfirm`;
// `0` turns it off. Widgets and fields inside one document count as one.

const getCallDocumentIds = require('./call-documents');

const DOOR = 'assistant';
// The documents a gate's confirmation names, then "and N more"; the panel
// lists a few and expands to the rest
const TITLES_MAX = 100;

module.exports = (self) => {
  return {
    /**
     * Adds a gate to a tool: before each of its calls in the assistant,
     * `predicate(args, context)` decides whether the editor is asked first.
     * A tool may have several gates; the first one firing asks.
     *
     * The predicate returns `true` to ask with the standard confirmation, or
     * an object to word its own, every key optional: `title`, `{ key,
     * values }` for `$t`; `text`, one line or an array of lines, each
     * `{ key, values }` or `{ list }`, strings joined as a list in the admin
     * UI's language; `approve`, the i18n key of the approving action; and
     * `alternatives`, `{ name, label, message }` each: `label` an i18n key,
     * `message` what the model reads when the editor picks it, the call
     * declined.
     *
     * @param {string} toolName
     * @param {(args: object, context: { req: object, documentCount: number,
     *   ids: string[], getScreen: () => Promise<object|null> })
     *   => boolean|object|Promise<boolean|object>} predicate `args` are the
     *   call's validated arguments; `documentCount` how many documents it
     *   changes, `ids` the ids it names them by; `getScreen` reads the
     *   request's verified screen.
     */
    addGate(toolName, predicate) {
      if (typeof predicate !== 'function') {
        throw new Error(`The gate of the tool "${toolName}" needs a predicate function.`);
      }
      self.gates[toolName] = [ ...(self.gates[toolName] || []), predicate ];
    },

    /**
     * Takes every gate off a tool, the standard one included; gates added
     * after it stand alone.
     *
     * @param {string} toolName
     */
    removeGate(toolName) {
      delete self.gates[toolName];
      self.ungated.add(toolName);
    },

    /**
     * Checks a tool call of the assistant against its tool's gates, as the
     * AI engine is about to run it (`beforeToolCall`). A firing gate
     * suspends the call with a `confirm` ask; the answer comes back as the
     * call's input, which this takes off before the tool sees it: approved,
     * the call runs; declined, it is refused. A call answered with input of
     * its own asked for itself, past its gates.
     *
     * @param {object} req
     * @param {object} payload The engine's `{ tool, args }`.
     */
    async checkGates(req, { tool, args }) {
      if (!self.active || (self.apos.harness.getDoor(req)?.door !== DOOR)) {
        return;
      }
      const gates = getGates();
      if (!gates.length) {
        return;
      }
      const { _context, ...validated } = args;
      const { input } = _context;
      if (input?.gate) {
        delete _context.input;
        if (input.approved) {
          return;
        }
        throw self.apos.error('aiToolError', input.message || ('the user declined this ' +
          'step, so nothing was written; don\'t try it again unless they ask'));
      }
      if (input !== undefined) {
        return;
      }
      const ids = getCallDocumentIds(req, validated);
      const documentCount = Math.max(ids.length, 1);
      let screen;
      const context = {
        req,
        documentCount,
        ids,
        async getScreen() {
          screen ??= (await self.requests.findOne({
            _id: self.apos.harness.getDoor(req).requestId,
            ownerId: self.getOwnerId(req)
          }, { projection: { screen: 1 } }))?.screen || null;
          return screen;
        }
      };
      for (const gate of gates) {
        const fired = await gate(validated, context);
        if (fired) {
          throw self.apos.error('aiInput', 'waiting for the user to confirm', {
            kind: 'confirm',
            gate: {
              ...await describe(ids, documentCount),
              ...((typeof fired === 'object') && getWording(fired))
            }
          });
        }
      }

      function getGates() {
        const standard = (tool.kind === 'action') && tool.tags?.includes('content') &&
          !self.ungated.has(tool.name);
        // The tool's own gates first: their wording is the more specific
        return [
          ...(self.gates[tool.name] || []),
          ...(standard ? [ exceedsDocuments ] : [])
        ];
      }

      function exceedsDocuments(args, { documentCount }) {
        const max = self.options.maxDocsWithoutConfirm;
        return (max > 0) && (documentCount > max);
      }

      // A gate's own wording, as the browser renders it
      function getWording({
        title, text, approve, alternatives
      }) {
        return {
          ...(title && { title }),
          ...(text && { text: [ text ].flat() }),
          ...(approve && { approve }),
          ...(alternatives?.length && {
            alternatives: alternatives.map(({
              name, label, message
            }) => ({
              name,
              label,
              message
            }))
          })
        };
      }

      // What the confirmation states: the step, the count, the type when
      // they share one, and the titles of the documents the editor can see
      async function describe(ids, count) {
        const docs = [];
        for (const id of ids) {
          try {
            docs.push((await self.apos.harness.findDraft(req, id)).doc);
          } catch (e) {
            if (e.name !== 'notfound') {
              throw e;
            }
          }
        }
        const types = [ ...new Set(docs.map(doc => doc.type)) ];
        const manager = (types.length === 1) ? self.apos.doc.getManager(types[0]) : null;
        const titles = docs.slice(0, TITLES_MAX).map(doc => doc.title || '');
        return {
          tool: tool.name,
          label: tool.label || null,
          count,
          typeLabel: manager?.options.pluralLabel || null,
          titles,
          more: Math.max(ids.length - titles.length, 0)
        };
      }
    }
  };
};
