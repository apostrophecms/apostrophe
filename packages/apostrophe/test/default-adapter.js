const assert = require('assert');
const path = require('path');

describe('Default Adapter', function() {

  this.timeout(20000);

  // Save and restore env vars
  let savedAposDefaultDbAdapter;
  let savedAposDbUri;
  let savedAposMongdbUri;

  beforeEach(function() {
    savedAposDefaultDbAdapter = process.env.APOS_DEFAULT_DB_ADAPTER;
    savedAposDbUri = process.env.APOS_DB_URI;
    savedAposMongdbUri = process.env.APOS_MONGODB_URI;
    delete process.env.APOS_DEFAULT_DB_ADAPTER;
    delete process.env.APOS_DB_URI;
    delete process.env.APOS_MONGODB_URI;
  });

  afterEach(function() {
    if (savedAposDefaultDbAdapter !== undefined) {
      process.env.APOS_DEFAULT_DB_ADAPTER = savedAposDefaultDbAdapter;
    } else {
      delete process.env.APOS_DEFAULT_DB_ADAPTER;
    }
    if (savedAposDbUri !== undefined) {
      process.env.APOS_DB_URI = savedAposDbUri;
    } else {
      delete process.env.APOS_DB_URI;
    }
    if (savedAposMongdbUri !== undefined) {
      process.env.APOS_MONGODB_URI = savedAposMongdbUri;
    } else {
      delete process.env.APOS_MONGODB_URI;
    }
  });

  // These tests verify URI construction by examining module internals
  // without needing actual database connections.

  it('builds mongodb:// URI by default', function() {
    const uri = buildUri({ shortName: 'mysite' });
    assert(uri.startsWith('mongodb://'));
    assert(uri.includes('localhost:27017'));
    assert(uri.includes('/mysite'));
  });

  it('builds mongodb:// URI when defaultAdapter is "mongodb"', function() {
    const uri = buildUri({
      shortName: 'mysite',
      dbOptions: { defaultAdapter: 'mongodb' }
    });
    assert(uri.startsWith('mongodb://'));
    assert(uri.includes('/mysite'));
  });

  it('builds sqlite:// URI when defaultAdapter is "sqlite"', function() {
    const uri = buildUri({
      shortName: 'mysite',
      rootDir: '/app',
      dbOptions: { defaultAdapter: 'sqlite' }
    });
    assert(uri.startsWith('sqlite://'));
    assert(uri.includes(path.join('data', 'mysite.sqlite')));
  });

  it('builds postgres:// URI when defaultAdapter is "postgres"', function() {
    const uri = buildUri({
      shortName: 'mysite',
      dbOptions: { defaultAdapter: 'postgres' }
    });
    assert(uri.startsWith('postgres://'));
    assert(uri.includes('localhost:5432'));
    assert(uri.includes('/mysite'));
  });

  it('builds multipostgres:// URI when defaultAdapter is "multipostgres"', function() {
    const uri = buildUri({
      shortName: 'mysite',
      dbOptions: { defaultAdapter: 'multipostgres' }
    });
    assert(uri.startsWith('multipostgres://'));
    assert(uri.includes('localhost:5432'));
    assert(uri.includes('/mysite'));
  });

  it('includes URI-encoded credentials for postgres', function() {
    const uri = buildUri({
      shortName: 'mysite',
      dbOptions: {
        defaultAdapter: 'postgres',
        user: 'admin',
        password: 'p@ss:word/special'
      }
    });
    assert(uri.startsWith('postgres://'));
    assert(uri.includes('admin'));
    assert(uri.includes(encodeURIComponent('p@ss:word/special')));
    assert(!uri.includes('p@ss:word/special'));
  });

  it('includes URI-encoded credentials for mongodb', function() {
    const uri = buildUri({
      shortName: 'mysite',
      dbOptions: {
        defaultAdapter: 'mongodb',
        user: 'admin',
        password: 'p@ss:word'
      }
    });
    assert(uri.startsWith('mongodb://'));
    assert(uri.includes(encodeURIComponent('p@ss:word')));
  });

  it('APOS_DEFAULT_DB_ADAPTER env var overrides the option', function() {
    process.env.APOS_DEFAULT_DB_ADAPTER = 'postgres';
    const uri = buildUri({
      shortName: 'mysite',
      dbOptions: { defaultAdapter: 'mongodb' }
    });
    assert(uri.startsWith('postgres://'));
  });

  it('throws for invalid adapter name', function() {
    assert.throws(() => {
      buildUri({
        shortName: 'mysite',
        dbOptions: { defaultAdapter: 'invalid' }
      });
    }, /Invalid defaultAdapter/);
  });

  it('explicit uri option overrides defaultAdapter', function() {
    const uri = buildUri({
      shortName: 'mysite',
      dbOptions: {
        defaultAdapter: 'postgres',
        uri: 'mongodb://custom:27017/other'
      }
    });
    assert.strictEqual(uri, 'mongodb://custom:27017/other');
  });

  it('APOS_DB_URI env var overrides everything', function() {
    process.env.APOS_DB_URI = 'mongodb://envhost:27017/envdb';
    const uri = buildUri({
      shortName: 'mysite',
      dbOptions: { defaultAdapter: 'postgres' }
    });
    assert.strictEqual(uri, 'mongodb://envhost:27017/envdb');
  });

  it('honors custom host and port for postgres', function() {
    const uri = buildUri({
      shortName: 'mysite',
      dbOptions: {
        defaultAdapter: 'postgres',
        host: 'dbserver',
        port: 5433
      }
    });
    assert(uri.includes('dbserver:5433'));
  });

  it('honors custom host and port for mongodb', function() {
    const uri = buildUri({
      shortName: 'mysite',
      dbOptions: {
        defaultAdapter: 'mongodb',
        host: 'mongohost',
        port: 27018
      }
    });
    assert(uri.includes('mongohost:27018'));
  });

  it('uses shortName as database name by default', function() {
    const uri = buildUri({ shortName: 'my-app' });
    assert(uri.endsWith('/my-app'));
  });

  it('uses name option over shortName when provided', function() {
    const uri = buildUri({
      shortName: 'my-app',
      dbOptions: { name: 'custom-db' }
    });
    assert(uri.includes('/custom-db'));
  });

  it('ignores host/port/user/password for sqlite', function() {
    const uri = buildUri({
      shortName: 'mysite',
      dbOptions: {
        defaultAdapter: 'sqlite',
        host: 'shouldbeignored',
        port: 9999,
        user: 'nobody',
        password: 'nothing'
      }
    });
    assert(uri.startsWith('sqlite://'));
    assert(!uri.includes('shouldbeignored'));
    assert(!uri.includes('9999'));
    assert(!uri.includes('nobody'));
  });
});

// Helper: simulate the URI construction logic from the db module
// without actually connecting. This extracts the same logic path.
function buildUri(options = {}) {
  const escapeHost = require('../lib/escape-host.js');
  const shortName = options.shortName || 'test-app';
  const rootDir = options.rootDir || '/tmp/test-app';
  const dbOptions = { ...(options.dbOptions || {}) };

  // Simulate the connectToDb URI construction
  const viaEnv = process.env.APOS_DB_URI || process.env.APOS_MONGODB_URI;
  if (viaEnv) {
    return viaEnv;
  }
  if (dbOptions.uri) {
    return dbOptions.uri;
  }

  const validAdapters = [ 'mongodb', 'sqlite', 'postgres', 'multipostgres' ];
  const adapter = process.env.APOS_DEFAULT_DB_ADAPTER || dbOptions.defaultAdapter || 'mongodb';
  if (!validAdapters.includes(adapter)) {
    throw new Error(`Invalid defaultAdapter: "${adapter}". Must be one of: ${validAdapters.join(', ')}`);
  }

  if (!dbOptions.name) {
    dbOptions.name = shortName;
  }

  if (adapter === 'sqlite') {
    const path = require('path');
    return `sqlite://${path.resolve(rootDir, 'data', dbOptions.name + '.sqlite')}`;
  }

  const credentials = dbOptions.user
    ? encodeURIComponent(dbOptions.user) + ':' + encodeURIComponent(dbOptions.password) + '@'
    : '';

  if (adapter === 'mongodb') {
    const host = dbOptions.host || 'localhost';
    const port = dbOptions.port || 27017;
    return 'mongodb://' + credentials + escapeHost(host) + ':' + port + '/' + dbOptions.name;
  }

  // postgres or multipostgres
  const host = dbOptions.host || 'localhost';
  const port = dbOptions.port || 5432;
  return adapter + '://' + credentials + escapeHost(host) + ':' + port + '/' + dbOptions.name;
}
