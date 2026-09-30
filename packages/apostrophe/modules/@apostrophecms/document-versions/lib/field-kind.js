// What a field type is under the name a project gave it: the `extend`
// chain of field types, walked once for the diff engine and the text reader.

/**
 * The first type along the `extend` chain of `field.type`, that type
 * included, that `names` holds. `null` when none is, a chain that loops
 * included.
 *
 * @param {object} field The schema field.
 * @param {import('./diff.js').DiffContext} ctx
 * @param {Set<string>} names
 * @returns {string|null}
 */
module.exports = function findBaseType(field, ctx, names) {
  const seen = new Set();
  let name = field.type;
  while (name && !seen.has(name)) {
    if (names.has(name)) {
      return name;
    }
    seen.add(name);
    name = ctx.getFieldType(name)?.extend;
  }
  return null;
};
