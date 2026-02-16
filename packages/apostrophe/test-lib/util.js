const { createId } = require('@paralleldrive/cuid2');

const testDbProtocol = process.env.APOS_TEST_DB_PROTOCOL || 'mongodb';

// Build a test database URI for postgres based on the shortName.
// Returns undefined for mongodb, letting the default logic handle it.
function getTestDbUri(shortName) {
  if (testDbProtocol === 'postgres') {
    // PostgreSQL database names cannot contain hyphens
    const dbName = shortName.replace(/-/g, '_');
    return `postgres://localhost:5432/${dbName}`;
  }
}

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
  const dbModule = apos.modules['@apostrophecms/db'];
  const { uri } = dbModule;
  const dbName = apos.db && (apos.db.databaseName || apos.db._name);
  await apos.destroy();
  if (!uri || !dbName) {
    return;
  }
  // Make a fresh connection (the original was closed by destroy)
  // and use it to drop the test database
  const client = await dbModule.connectToAdapter(uri);
  const db = client.db(dbName);
  await db.dropDatabase();
  await client.close();
};

async function create(options = {}) {
  const config = {
    shortName: options.shortName || `test-${createId()}`,
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
  // When APOS_TEST_DB_PROTOCOL=postgres, automatically configure the db
  // module to use a postgres URI unless already explicitly configured
  const testUri = getTestDbUri(config.shortName);
  if (testUri) {
    config.modules = config.modules || {};
    const dbModule = config.modules['@apostrophecms/db'] || {};
    dbModule.options = dbModule.options || {};
    if (!dbModule.options.uri && !dbModule.options.client) {
      dbModule.options.uri = testUri;
    }
    config.modules['@apostrophecms/db'] = dbModule;
  }
  return require('../index.js')(config);
}

// Create an admin user. Invokes createUser with the `admin` role.
// Accepts the same options.

async function createAdmin(apos, {
  username, password, title, email
} = {}) {
  return createUser(apos, 'admin', {
    username,
    password,
    title,
    email
  });
}

// Resolves to a user with the specified `role`. `username` defaults to
// `role`. `title` defaults to `username` or `role`.
// `password` defaults to `username` or `role`. `email` defaults to
// `${username}@test.io` where `username` can also be inferred from `role`.

async function createUser(apos, role, {
  username, password, title, email
} = {}) {
  title = title || username || role;
  username = username || role;
  password = password || username || role;
  email = email || `${username}@test.io`;

  return apos.user.insert(
    apos.task.getReq(),
    {
      ...apos.user.newInstance(),
      title,
      username,
      password,
      email,
      role
    }
  );
}

// Log in with the specified password. Returns a
// cookie jar object for use with additional
// apos.http calls via the `jar` option.
// `password` defaults to `username`.

async function loginAs(apos, username, password) {
  password = password || username;
  const jar = apos.http.jar();
  await apos.http.post('/api/v1/@apostrophecms/login/login', {
    body: {
      username,
      password,
      session: true
    },
    jar
  });

  return jar;
};

async function logout(apos, username, password, jar) {
  await apos.http.post(
    '/api/v1/@apostrophecms/login/logout',
    {
      body: {
        username,
        password,
        session: true
      },
      jar
    }
  );
  await apos.http.get(
    '/',
    {
      jar
    }
  );
};

// Deprecated legacy wrapper for loginAs.
function getUserJar(apos, { username = 'admin', password } = {}) {
  return loginAs(apos, username, password);
}

module.exports = {
  destroy,
  create,
  createAdmin,
  createUser,
  loginAs,
  logout,
  getUserJar,
  testDbProtocol,
  timeout: (process.env.TEST_TIMEOUT && parseInt(process.env.TEST_TIMEOUT)) || 20000
};
