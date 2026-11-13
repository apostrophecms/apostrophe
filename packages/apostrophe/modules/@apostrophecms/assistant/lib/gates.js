// Approval gates: checks that make the run ask the editor before a tool
// runs. A gate is a tool name and a predicate on the call's validated
// arguments. When one fires, the call suspends with a `confirm` ask stating
// the action and the count, and runs once approved; declined, it writes
// nothing and the model hears so. Gates are the assistant's: the harness's
// tools never ask, and the MCP door has none.
//
// One gate ships on every write tool (an action tagged `content`): it fires
// when one call would change more documents than `maxDocsWithoutConfirm`;
// `0` turns it off. Widgets and fields inside one document count as one.

const DOOR = 'assistant';
// The documents a gate's confirmation names, then "and N more"
const TITLES_MAX = 5;

module.exports = (self) => {
  return {
    /**
     * Adds a gate to a tool: before each of its calls in the assistant,
     * `predicate(args, { req, documentCount })` decides whether the editor
     * is asked first. A tool may have several gates; any one firing asks.
     *
     * @param {string} toolName
     * @param {(args: object, context: { req: object, documentCount: number })
     *   => boolean|Promise<boolean>} predicate `args` are the call's
     *   validated arguments; `documentCount` how many documents it changes.
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
        throw self.apos.error('aiToolError', 'the user declined this step, so nothing was ' +
          'written; don\'t try it again unless they ask');
      }
      if (input !== undefined) {
        return;
      }
      const ids = getDocumentIds();
      const documentCount = Math.max(ids.length, 1);
      for (const gate of gates) {
        if (await gate(validated, {
          req,
          documentCount
        })) {
          throw self.apos.error('aiInput', 'waiting for the user to confirm', {
            kind: 'confirm',
            gate: await describe(ids, documentCount)
          });
        }
      }

      function getGates() {
        const standard = (tool.kind === 'action') && tool.tags?.includes('content') &&
          !self.ungated.has(tool.name);
        return [
          ...(standard ? [ exceedsDocuments ] : []),
          ...(self.gates[tool.name] || [])
        ];
      }

      function exceedsDocuments(args, { documentCount }) {
        const max = self.options.maxDocsWithoutConfirm;
        return (max > 0) && (documentCount > max);
      }

      // The documents the call names, once each: by `targets[]._id`, else
      // `_id`. An id names a document with or without its locale and mode
      function getDocumentIds() {
        const given = Array.isArray(validated.targets)
          ? validated.targets.map(target => target?._id)
          : [ validated._id ];
        const ids = new Map();
        for (const id of given) {
          if ((typeof id !== 'string') || !id) {
            continue;
          }
          const [ aposDocId, locale ] = id.split(':');
          ids.set(`${aposDocId}:${locale || req.locale}`, id);
        }
        return [ ...ids.values() ];
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
