import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, writeFileSync, readFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dbConfig } from '../../src/core/steps/db-config.js';
import { StageError } from '../../src/core/errors.js';

describe('core/steps/db-config', function () {
  let appRoot;
  const readEnv = () => readFileSync(join(appRoot, '.env'), 'utf8');

  beforeEach(function () {
    appRoot = mkdtempSync(join(tmpdir(), 'ca-db-'));
  });

  afterEach(function () {
    rmSync(appRoot, {
      recursive: true,
      force: true
    });
  });

  it('sqlite: adapter only, no URI even if dbUri is passed', async function () {
    const res = await dbConfig({
      appRoot,
      dbChoice: 'sqlite',
      dbUri: 'ignored://x'
    });
    assert.deepEqual(res, { dbChoice: 'sqlite' });
    const env = readEnv();
    assert.match(env, /^APOS_DEFAULT_DB_ADAPTER=sqlite$/m);
    assert.doesNotMatch(env, /APOS_DB_URI/);
  });

  it('mongodb with a connection string: adapter + APOS_DB_URI', async function () {
    await dbConfig({
      appRoot,
      dbChoice: 'mongodb',
      dbUri: 'mongodb://localhost:27017/my-site'
    });
    const env = readEnv();
    assert.match(env, /^APOS_DEFAULT_DB_ADAPTER=mongodb$/m);
    assert.match(env, /^APOS_DB_URI=mongodb:\/\/localhost:27017\/my-site$/m);
  });

  it('postgres without a connection string: adapter only (core defaults host)', async function () {
    await dbConfig({
      appRoot,
      dbChoice: 'postgres'
    });
    const env = readEnv();
    assert.match(env, /^APOS_DEFAULT_DB_ADAPTER=postgres$/m);
    assert.doesNotMatch(env, /APOS_DB_URI/);
  });

  it('preserves scaffold-written keys (upsert, not overwrite)', async function () {
    writeFileSync(join(appRoot, '.env'), 'APOS_SESSION_SECRET=abc\n');
    await dbConfig({
      appRoot,
      dbChoice: 'sqlite'
    });
    const env = readEnv();
    assert.match(env, /^APOS_SESSION_SECRET=abc$/m);
    assert.match(env, /^APOS_DEFAULT_DB_ADAPTER=sqlite$/m);
  });

  it('rejects an unknown dbChoice', async function () {
    await assert.rejects(
      () => dbConfig({
        appRoot,
        dbChoice: 'mysql'
      }),
      TypeError
    );
  });

  it('verifies the resolved URI; success returns normally', async function () {
    let seen;
    const res = await dbConfig(
      {
        appRoot,
        dbChoice: 'postgres',
        dbUri: 'postgres://h/db',
        shortName: 'my-site'
      },
      {
        verifyConnection: async (uri) => {
          seen = uri;
          return { reachable: true };
        }
      }
    );
    // mongodb/postgres pass the user URI through verbatim.
    assert.equal(seen, 'postgres://h/db');
    assert.deepEqual(res, { dbChoice: 'postgres' });
  });

  it('verifies the derived sqlite URI (no user dbUri)', async function () {
    let seen;
    await dbConfig(
      {
        appRoot,
        dbChoice: 'sqlite',
        shortName: 'my-site'
      },
      {
        verifyConnection: async (uri) => {
          seen = uri;
          return { reachable: true };
        }
      }
    );
    assert.match(seen, /^sqlite:\/\/.*\/data\/my-site\.sqlite$/);
  });

  it('skips the check entirely when no verifyConnection is wired', async function () {
    // No deps → env written, no connection attempted (shortName not required).
    const res = await dbConfig({
      appRoot,
      dbChoice: 'mongodb',
      dbUri: 'mongodb://h/db'
    });
    assert.deepEqual(res, { dbChoice: 'mongodb' });
  });

  it('dbReset=drop: drops the resolved URI after a passing check', async function () {
    const seen = {};
    await dbConfig(
      {
        appRoot,
        dbChoice: 'postgres',
        dbUri: 'postgres://h/db',
        shortName: 'my-site',
        dbReset: 'drop'
      },
      {
        verifyConnection: async (uri) => {
          seen.checked = uri;
          return { reachable: true };
        },
        dropDatabase: async (uri) => {
          seen.dropped = uri;
        }
      }
    );
    assert.equal(seen.checked, 'postgres://h/db');
    assert.equal(seen.dropped, 'postgres://h/db');
  });

  it('dbReset=keep (default): never drops', async function () {
    let dropped = false;
    await dbConfig(
      {
        appRoot,
        dbChoice: 'postgres',
        dbUri: 'postgres://h/db',
        shortName: 'my-site'
      },
      {
        verifyConnection: async () => ({ reachable: true }),
        dropDatabase: async () => {
          dropped = true;
        }
      }
    );
    assert.equal(dropped, false);
  });

  it('a failed check short-circuits before any drop', async function () {
    let dropped = false;
    await assert.rejects(
      () => dbConfig(
        {
          appRoot,
          dbChoice: 'mongodb',
          dbUri: 'mongodb://bad/db',
          shortName: 'my-site',
          dbReset: 'drop'
        },
        {
          verifyConnection: async () => ({
            reachable: false,
            reason: 'auth'
          }),
          dropDatabase: async () => {
            dropped = true;
          }
        }
      ),
      (err) => err instanceof StageError && err.errorCode === 'db_auth_failed'
    );
    assert.equal(dropped, false, 'must not drop when the connection check failed');
  });

  it('drop failure → StageError(db_connect, db_drop_failed)', async function () {
    await assert.rejects(
      () => dbConfig(
        {
          appRoot,
          dbChoice: 'postgres',
          dbUri: 'postgres://h/db',
          shortName: 'my-site',
          dbReset: 'drop'
        },
        {
          verifyConnection: async () => ({ reachable: true }),
          dropDatabase: async () => {
            throw new Error('permission denied to drop tables');
          }
        }
      ),
      (err) => {
        assert.ok(err instanceof StageError);
        assert.equal(err.stage, 'db_connect');
        assert.equal(err.errorCode, 'db_drop_failed');
        assert.doesNotMatch(String(err.errorCode), /permission denied/);
        return true;
      }
    );
  });

  /** @type {Array<[string, string]>} reason → mapped errorCode */
  const reasonCases = [
    [ 'unreachable', 'db_unreachable' ],
    [ 'auth', 'db_auth_failed' ],
    [ 'unknown', 'db_connect_failed' ]
  ];
  for (const [ reason, code ] of reasonCases) {
    it(`unreachable verdict (${reason}) → StageError(db_connect, ${code})`, async function () {
      await assert.rejects(
        () => dbConfig(
          {
            appRoot,
            dbChoice: 'mongodb',
            dbUri: 'mongodb://bad/db',
            shortName: 'my-site'
          },
          {
            verifyConnection: async () => ({
              reachable: false,
              reason,
              message: 'connect ECONNREFUSED 127.0.0.1:27017'
            })
          }
        ),
        (err) => {
          assert.ok(err instanceof StageError);
          assert.equal(err.stage, 'db_connect');
          assert.equal(err.errorCode, code);
          // The symbolic code never carries the raw driver string.
          assert.doesNotMatch(String(err.errorCode), /ECONNREFUSED/);
          return true;
        }
      );
    });
  }
});
