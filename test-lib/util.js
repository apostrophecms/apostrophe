const cuid = require('cuid');
const mongodbConnect = require('../lib/mongodb-connect');

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
  await apos.destroy();
  const { uri } = apos.modules['@apostrophecms/db'];
  const dbName = apos.db && apos.db.databaseName;
  // TODO at some point accommodate nonsense like testing remote databases
  // that won't let us use dropDatabase, no shell available etc., but the
  // important principle here is that we should not have to have an apos
  // object to clean up the database, otherwise we have to get hold of one
  // when initialization failed and that's really not apostrophe's concern
  if (dbName && uri) {
    const client = await mongodbConnect(`${uri}${dbName}`);
    const db = client.db(dbName);
    await db.dropDatabase();
    await client.close();
  }
};

async function create(options) {
  const config = {
    shortName: options.shortName || `test-${cuid()}`,
    argv: {
      _: [],
      'ignore-orphan-modules': true
    },
    test: true,
    autoBuild: false,
    ...options
  };
  // Automatically configure Express, but not if we're in a special
  // environment where the default apostrophe modules don't initialize
  // TODO: Remove __testDefaults references in 4.x major version or formalize
  // intended usage with documentation.
  if (!config.__testDefaults) {
    config.modules = config.modules || {};
    const express = config.modules['@apostrophecms/express'] || {};
    express.options = express.options || {};
    // Allow OS to choose open port if not explicitly set.
    express.options.port = express.options.port || null;
    express.options.address = express.options.address || 'localhost';
    express.options.session = express.options.session || {};
    express.options.session.secret = express.options.session.secret || 'test';
    config.modules['@apostrophecms/express'] = express;
  }
  return require('../index.js')(config);
}

// Create an admin user. By default the username and password are both 'admin'
async function createAdmin(apos, { username, password } = {}) {
  const user = apos.user.newInstance();
  const name = username || 'admin';

  user.title = name;
  user.username = name;
  user.password = password || 'admin';
  user.email = `${name}@admin.io`;
  user.role = 'admin';

  return await apos.user.insert(apos.task.getReq(), user);
}

async function getUserJar(apos, { username, password } = {}) {
  const jar = apos.http.jar();

  // Log in
  await apos.http.post('/api/v1/@apostrophecms/login/login', {
    body: {
      username: username || 'admin',
      password: password || 'admin',
      session: true
    },
    jar
  });

  return jar;
}

module.exports = {
  destroy,
  create,
  createAdmin,
  getUserJar,
  timeout: (process.env.TEST_TIMEOUT && parseInt(process.env.TEST_TIMEOUT)) || 20000
};
