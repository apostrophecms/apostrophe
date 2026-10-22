// The value a See Changes entry edits, read from the draft as an editor
// loads it: relationships come with their related documents

// The value at `patchKey` of the draft `docId`: the field names, dotted,
// from the top level or from the object whose `_id` follows `@`. Related
// documents loaded with the draft are not looked into. Rejects when the
// draft cannot be loaded
async function load(docId, patchKey) {
  const doc = await apos.http.get(
    `${apos.modules['@apostrophecms/doc'].action}/${docId}`,
    { draft: true }
  );
  const names = patchKey.split('.');
  let node = names[0].startsWith('@')
    ? findById(doc, names.shift().substring(1))
    : doc;
  for (const name of names) {
    node = node?.[name];
  }
  return node;

  function findById(node, id) {
    if (!node || (typeof node !== 'object')) {
      return null;
    }
    if (node._id === id) {
      return node;
    }
    const children = Array.isArray(node)
      ? node
      : Object.entries(node)
        .filter(([ key ]) => !key.startsWith('_'))
        .map(([ , child ]) => child);
    for (const child of children) {
      const found = findById(child, id);
      if (found) {
        return found;
      }
    }
    return null;
  }
}

export default {
  load
};
