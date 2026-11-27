// The documents a write tool's call names, once each: by `targets[]._id`,
// else `_id`. An id names a document with or without its locale and mode;
// without one it is in the locale of `req`. Each document's id as the call
// first gives it.
module.exports = function getCallDocumentIds(req, args) {
  const given = Array.isArray(args.targets)
    ? args.targets.map(target => target?._id)
    : [ args._id ];
  const ids = new Map();
  for (const id of given) {
    if ((typeof id !== 'string') || !id) {
      continue;
    }
    ids.set(getDocumentKey(req, id), id);
  }
  return [ ...ids.values() ];
};

// `<aposDocId>:<locale>` for a document id with or without its locale and
// mode
function getDocumentKey(req, id) {
  const [ aposDocId, locale ] = id.split(':');
  return `${aposDocId}:${locale || req.locale}`;
}

module.exports.getDocumentKey = getDocumentKey;
