import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, existsSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import dbConnect from '@apostrophecms/db-connect';
import {
  resolveDbUri, inspect, checkConnection, dropDatabase, restore
} from '../../src/core/db.js';

// A fake db-connect client whose db() exposes just the surface db.js uses.
// Records whether close()/dropDatabase() were called and what connect opts
// it was handed.
function makeClient(collections = []) {
  const calls = {
    closed: false,
    dropped: false
  };
  const client = {
    db() {
      return {
        listCollections() {
          return {
            async toArray() {
              return collections;
            }
          };
        },
        async dropDatabase() {
          calls.dropped = true;
        }
      };
    },
    async close() {
      calls.closed = true;
    }
  };
  return {
    client,
    calls
  };
}

// connect stub that records the (uri, opts) it was called with and returns
// the given client (or throws the given error).
function stubConnect({ client, error } = {}) {
  const seen = {};
  const connect = async (uri, opts) => {
    seen.uri = uri;
    seen.opts = opts;
    if (error) {
      throw error;
    }
    return client;
  };
  return {
    connect,
    seen
  };
}

describe('core/db — resolveDbUri', function () {
  const appRoot = '/srv/app';

  it('sqlite: core formula — sqlite:// + <appRoot>/data/<shortName>.sqlite', function () {
    const uri = resolveDbUri({
      dbChoice: 'sqlite',
      appRoot,
      shortName: 'my-site'
    });
    assert.equal(uri, `sqlite://${resolve(appRoot, 'data', 'my-site.sqlite')}`);
  });

  it('mongodb / postgres: the supplied dbUri verbatim', function () {
    assert.equal(
      resolveDbUri({
        dbChoice: 'mongodb',
        dbUri: 'mongodb://localhost:27017/my-site',
        appRoot,
        shortName: 'my-site'
      }),
      'mongodb://localhost:27017/my-site'
    );
    assert.equal(
      resolveDbUri({
        dbChoice: 'postgres',
        dbUri: 'postgres://postgres@localhost:5432/my-site',
        appRoot,
        shortName: 'my-site'
      }),
      'postgres://postgres@localhost:5432/my-site'
    );
  });

  it('throws when mongodb/postgres has no dbUri', function () {
    assert.throws(
      () => resolveDbUri({
        dbChoice: 'mongodb',
        appRoot,
        shortName: 'my-site'
      }),
      TypeError
    );
  });

  it('re-validates shortName at the path boundary (zip-slip / traversal)', function () {
    for (const bad of [ '../evil', 'a/b', 'x\0y', '' ]) {
      assert.throws(
        () => resolveDbUri({
          dbChoice: 'sqlite',
          appRoot,
          shortName: bad
        }),
        TypeError,
        `should reject ${JSON.stringify(bad)}`
      );
    }
  });
});

describe('core/db — sqlite end-to-end (real temp file)', function () {
  let appRoot;
  let uri;

  const DUMP = [
    '{"_collection":"articles","_indexes":[]}',
    '{"_doc":{"_id":"a1","title":"Hello"}}',
    '{"_doc":{"_id":"a2","title":"World"}}'
  ].join('\n');

  beforeEach(function () {
    appRoot = mkdtempSync(join(tmpdir(), 'ca-db-'));
    uri = resolveDbUri({
      dbChoice: 'sqlite',
      appRoot,
      shortName: 'site'
    });
  });

  afterEach(function () {
    rmSync(appRoot, {
      recursive: true,
      force: true
    });
  });

  it('restore writes the dump and it reads back', async function () {
    await restore(uri, DUMP);

    // The sqlite adapter created data/ and the db file on connect.
    assert.ok(existsSync(join(appRoot, 'data', 'site.sqlite')));

    const client = await dbConnect(uri);
    try {
      const names = (await client.db().listCollections().toArray())
        .map(c => c.name);
      assert.ok(names.includes('articles'), 'articles collection present');
      const docs = await client.db().collection('articles').find({}).toArray();
      assert.equal(docs.length, 2);
      assert.deepEqual(docs.map(d => d.title).sort(), [ 'Hello', 'World' ]);
    } finally {
      await client.close();
    }
  });

  it('dropDatabase clears collections (empty read-back)', async function () {
    await restore(uri, DUMP);
    await dropDatabase(uri);

    const client = await dbConnect(uri);
    try {
      const names = await client.db().listCollections().toArray();
      assert.equal(names.length, 0, 'no collections after drop');
    } finally {
      await client.close();
    }
  });

  it('inspect reports a fresh sqlite as reachable + empty', async function () {
    const res = await inspect(uri);
    assert.deepEqual(res, {
      reachable: true,
      empty: true,
      collectionCount: 0
    });
  });

  it('inspect reports a populated sqlite as reachable + non-empty', async function () {
    await restore(uri, DUMP);
    const res = await inspect(uri);
    assert.deepEqual(res, {
      reachable: true,
      empty: false,
      collectionCount: 1
    });
  });
});

describe('core/db — inspect (mongodb/postgres via injected connect)', function () {
  it('reachable + empty when listCollections returns nothing', async function () {
    const { client, calls } = makeClient([]);
    const { connect, seen } = stubConnect({ client });
    const res = await inspect('mongodb://h/db', { connect });
    assert.deepEqual(res, {
      reachable: true,
      empty: true,
      collectionCount: 0
    });
    assert.equal(calls.closed, true, 'client closed');
    // mongo gets a server-selection timeout.
    assert.ok('serverSelectionTimeoutMS' in seen.opts);
  });

  it('reachable + non-empty reports the collection count', async function () {
    const { client } = makeClient([ { name: 'a' }, { name: 'b' }, { name: 'c' } ]);
    const { connect } = stubConnect({ client });
    const res = await inspect('mongodb://h/db', { connect });
    assert.deepEqual(res, {
      reachable: true,
      empty: false,
      collectionCount: 3
    });
  });

  it('postgres gets a connection timeout option', async function () {
    const { client } = makeClient([]);
    const { connect, seen } = stubConnect({ client });
    await inspect('postgres://h/db', {
      connect,
      timeoutMs: 1234
    });
    assert.deepEqual(seen.opts, { connectionTimeoutMillis: 1234 });
  });

  it('classifies ECONNREFUSED as unreachable', async function () {
    const err = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    const { connect } = stubConnect({ error: err });
    const res = await inspect('mongodb://h/db', { connect });
    assert.equal(res.reachable, false);
    assert.equal(res.reason, 'unreachable');
    assert.equal(res.message, 'connect ECONNREFUSED');
  });

  it('classifies mongo AuthenticationFailed as auth', async function () {
    const err = Object.assign(new Error('Authentication failed.'), {
      code: 18,
      codeName: 'AuthenticationFailed'
    });
    const { connect } = stubConnect({ error: err });
    const res = await inspect('mongodb://h/db', { connect });
    assert.equal(res.reason, 'auth');
  });

  it('classifies postgres 28P01 as auth', async function () {
    const err = Object.assign(new Error('password authentication failed'), { code: '28P01' });
    const { connect } = stubConnect({ error: err });
    const res = await inspect('postgres://h/db', { connect });
    assert.equal(res.reason, 'auth');
  });

  it('classifies an unknown error as unknown and preserves the message', async function () {
    const { connect } = stubConnect({ error: new Error('something odd') });
    const res = await inspect('mongodb://h/db', { connect });
    assert.equal(res.reason, 'unknown');
    assert.equal(res.message, 'something odd');
  });
});

describe('core/db — checkConnection', function () {
  it('reachable: returns only { reachable: true }', async function () {
    const { client } = makeClient([ { name: 'x' } ]);
    const { connect } = stubConnect({ client });
    const res = await checkConnection('mongodb://h/db', { connect });
    assert.deepEqual(res, { reachable: true });
  });

  it('unreachable: surfaces reason + message', async function () {
    const err = Object.assign(new Error('boom'), { code: 'ECONNREFUSED' });
    const { connect } = stubConnect({ error: err });
    const res = await checkConnection('mongodb://h/db', { connect });
    assert.deepEqual(res, {
      reachable: false,
      reason: 'unreachable',
      message: 'boom'
    });
  });
});

describe('core/db — dropDatabase (via injected connect)', function () {
  it('drops the database and closes the client', async function () {
    const { client, calls } = makeClient([ { name: 'x' } ]);
    const { connect } = stubConnect({ client });
    await dropDatabase('mongodb://h/db', { connect });
    assert.equal(calls.dropped, true);
    assert.equal(calls.closed, true);
  });
});

describe('core/db — restore (via injected impl)', function () {
  it('delegates to db-connect restore with (uri, source) for non-sqlite', async function () {
    const seen = {};
    const restoreImpl = async (uri, source) => {
      seen.uri = uri;
      seen.source = source;
    };
    await restore('mongodb://h/db', 'the-source', { restore: restoreImpl });
    assert.equal(seen.uri, 'mongodb://h/db');
    assert.equal(seen.source, 'the-source');
  });
});
