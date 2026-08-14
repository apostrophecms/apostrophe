// Shared machinery of the content extraction walk. See the
// `extract` method of the schema module for the contract.

const _ = require('lodash');

// Marks items already finalized by the extract walk, so a reentrant
// walk never reprocesses what a nested level produced
const extracted = Symbol('apos.schema.extract');

// Fill an item's missing properties from its origin context and union
// its tags, exactly once, mutating in place; an already finalized item
// passes through untouched. `defaults` carries `path`, `schemaPath`,
// `type`, `label` and `tags`.
function finalize(item, defaults) {
  if (item[extracted]) {
    return item;
  }
  item.path ??= defaults.path;
  item.schemaPath ??= defaults.schemaPath;
  item.type ??= defaults.type;
  item.label ??= defaults.label;
  item.tags = item.tags?.length
    ? _.uniq([ ...defaults.tags, ...item.tags ])
    : defaults.tags.slice();
  // Non-enumerable: the stamp must stay invisible to consumers
  // serializing or comparing items
  Object.defineProperty(item, extracted, { value: true });
  return item;
}

// Consult a caller-supplied probe at a dispatch point. Returns the
// items array the probe supplied in place of the default extraction,
// or `null` when the probe declines (returns undefined or null). Any
// other return value is a contract violation.
function consultProbe(self, probe, context) {
  const found = probe(context);
  if (found == null) {
    return null;
  }
  if (!Array.isArray(found)) {
    throw self.apos.error(
      'invalid',
      'The extract "probe" must return an array of items or undefined, ' +
      `got ${typeof found} at the ${context.kind} dispatch point "${context.schemaPath}"`
    );
  }
  return found;
}

module.exports = {
  extracted,
  finalize,
  consultProbe
};
