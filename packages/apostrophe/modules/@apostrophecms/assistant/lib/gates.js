// Approval gates: checks that make the run ask the editor before a tool
// runs. A gate is a tool name and a predicate on the call's validated
// arguments. When one fires, the call suspends with a `confirm` ask stating
// the action and the count, and runs once approved; declined, it writes
// nothing and the model hears so. A gate may word its own confirmation and
// offer alternatives, each a decline that tells the model what to do
// instead. Gates are the assistant's: the harness's tools never ask, and the
// MCP door has none.
//
// Gates have names, one gate per name and tool. One gate ships on every write
// tool (an action tagged `content`), `documentCount`: it fires when one call
// would change more documents than `maxDocsWithoutConfirm`; `0` turns it
// off. Widgets and fields inside one document count as one. Publishing has a
// gate of its own, `publish`, that always asks. `removeGate` takes any of
// them off by name, and a gate added under a name replaces it.

const getCallDocumentIds = require('./call-documents');

const DOOR = 'assistant';
const PUBLISH_TOOL = 'publish_document';
// The standard gate's name
const COUNT_GATE = 'documentCount';
// The documents a gate's confirmation names, then "and N more"; the panel
// lists a few and expands to the rest
const TITLES_MAX = 100;

module.exports = (self) => {
  return {
    /**
     * Adds a gate to a tool: before each of its calls in the assistant,
     * `predicate(args, context)` decides whether the editor is asked first.
     * A tool may have several gates; the first one firing asks, a tool's
     * own before the standard `documentCount`. A gate added under a name the
     * tool's gates already have replaces that gate, the standard one too.
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
     * @param {string} name The gate's name among the tool's gates.
     * @param {(args: object, context: { req: object, documentCount: number,
     *   ids: string[], getScreen: () => Promise<object|null> })
     *   => boolean|object|Promise<boolean|object>} predicate `args` are the
     *   call's validated arguments; `documentCount` how many documents it
     *   changes, `ids` the ids it names them by; `getScreen` reads the
     *   request's verified screen.
     */
    addGate(toolName, name, predicate) {
      if ((typeof name !== 'string') || !name) {
        throw new Error(`A gate of the tool "${toolName}" needs a name.`);
      }
      if (typeof predicate !== 'function') {
        throw new Error(
          `The gate "${name}" of the tool "${toolName}" needs a predicate function.`
        );
      }
      self.gates[toolName] ??= new Map();
      self.gates[toolName].set(name, predicate);
      self.removedGates[toolName]?.delete(name);
    },

    // Registers the gate on publishing: it asks every time, as a publish puts
    // drafts live and a revert doesn't take it back
    addPublishGate() {
      self.addGate(PUBLISH_TOOL, 'publish', (args, { documentCount }) => ({
        title: {
          key: 'aposAssistant:assistantGatePublish',
          values: { count: documentCount }
        },
        approve: 'apostrophe:publish'
      }));
    },

    /**
     * Takes the gate `name` off a tool, the standard `documentCount` too.
     * Without a name, every gate of the tool, the standard one included;
     * gates added after it stand alone.
     *
     * @param {string} toolName
     * @param {string} [name]
     */
    removeGate(toolName, name) {
      const names = name
        ? [ name ]
        : [ ...(self.gates[toolName]?.keys() || []), COUNT_GATE ];
      for (const each of names) {
        self.gates[toolName]?.delete(each);
        self.removedGates[toolName] ??= new Set();
        self.removedGates[toolName].add(each);
      }
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
      if (!self.active || (self.apos.aposHarness.getDoor(req)?.door !== DOOR)) {
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
            _id: self.apos.aposHarness.getDoor(req).requestId,
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
        const own = self.gates[tool.name] || new Map();
        // Unless removed, or replaced by a gate of the tool's own
        const standard = (tool.kind === 'action') && tool.tags?.includes('content') &&
          !own.has(COUNT_GATE) && !self.removedGates[tool.name]?.has(COUNT_GATE);
        // The tool's own gates first: their wording is the more specific
        return [
          ...own.values(),
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
            docs.push((await self.apos.aposHarness.findDraft(req, id)).doc);
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
