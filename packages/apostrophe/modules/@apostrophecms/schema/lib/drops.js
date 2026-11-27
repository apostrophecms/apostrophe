// Helpers for the drops `convert` records, see `convert` in `../index.js`

// The dot path of a field
function dropPathOf(dropPath, name) {
  return dropPath ? `${dropPath}.${name}` : name;
}

// The ids a relationship value names, whether its entries are related
// documents, `{ _id }` objects or strings
function relationshipIds(value) {
  return (Array.isArray(value) ? value : [])
    .map(entry => ((typeof entry) === 'string') ? entry : entry?._id);
}

module.exports = {
  dropPathOf,
  relationshipIds
};
