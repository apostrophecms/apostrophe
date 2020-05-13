// Properly clean up an apostrophe instance and drop its
// database collections to create a sane environment for the next test.
// Drops the collections, not the entire database, to avoid problems
// when testing something like a mongodb hosting environment with
// credentials per database.
//
// If `apos` is null, no work is done.

async function destroy(apos) {
  const dbName = apos.db && apos.db.databaseName;
  if (apos) {
    await apos.destroy();
  }
  // TODO at some point accommodate nonsense like testing remote databases
  // that won't let us use dropDatabase, no shell available etc., but the
  // important principle here is that we should not have to have an apos
  // object to clean up the database, otherwise we have to get hold of one
  // when initialization failed and that's really not apostrophe's concern
  if (dbName) {
    require('child_process').execSync(`mongo ${dbName} --eval 'db.dropDatabase()'`);
  }
};

module.exports = {
  destroy: destroy,
  timeout: (process.env.TEST_TIMEOUT && parseInt(process.env.TEST_TIMEOUT)) || 20000
};
