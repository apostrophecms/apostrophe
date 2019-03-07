// Properly clean up an apostrophe instance and drop its
// database collections to create a sane environment for the next test.
// Drops the collections, not the entire database, to avoid problems
// when testing something like a mongodb hosting environment with
// credentials per database.
//
// If `apos` is null, no work is done.

async function destroy(apos) {
  if (!apos) {
    return;
  }
  await drop();
  await apos.destroy();
  async function drop() {
    if (!(apos.db && apos.db.collections)) {
      return;
    }
    const collections = await apos.db.collections();
    for (const collection of collections) {
      // Avoid collections that are internal to mongodb bookkeeping
      if (!collection.collectionName.match(/^system\./)) {
        await collection.drop();
      }
    }
  }
};

module.exports = {
  destroy: destroy,
  timeout: (process.env.TEST_TIMEOUT && parseInt(process.env.TEST_TIMEOUT)) || 5000
};
