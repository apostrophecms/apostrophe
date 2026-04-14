const dump = require('./dump');
const restore = require('./restore');

// Copy a database by streaming NDJSON from source to destination — the
// dump is never fully materialized in memory, so this works regardless
// of database size.
//
// Accept either URI strings or already-connected db objects (or a mix).
module.exports = async function copyDatabase(fromUriOrDb, toUriOrDb) {
  await restore(toUriOrDb, dump(fromUriOrDb));
};
