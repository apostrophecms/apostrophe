const dump = require('./dump');
const restore = require('./restore');

// Accept either URI strings or already-connected db objects (or a mix).
module.exports = async function copyDatabase(fromUriOrDb, toUriOrDb) {
  const data = await dump(fromUriOrDb);
  await restore(toUriOrDb, data);
};
