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

  it('passes probe info; success returns normally', async function () {
    let seen;
    const res = await dbConfig(
      {
        appRoot,
        dbChoice: 'postgres',
        dbUri: 'postgres://h/db'
      },
      {
        verifyConnection: async (info) => {
          seen = info;
        }
      }
    );
    assert.deepEqual(seen, {
      dbChoice: 'postgres',
      dbUri: 'postgres://h/db'
    });
    assert.deepEqual(res, { dbChoice: 'postgres' });
  });

  it('probe rejection → StageError(db_connect, db_connect_failed)', async function () {
    await assert.rejects(
      () => dbConfig(
        {
          appRoot,
          dbChoice: 'mongodb',
          dbUri: 'mongodb://bad/db'
        },
        {
          verifyConnection: async () => {
            throw new Error('ECONNREFUSED');
          }
        }
      ),
      (err) => {
        assert.ok(err instanceof StageError);
        assert.equal(err.stage, 'db_connect');
        assert.equal(err.errorCode, 'db_connect_failed');
        assert.doesNotMatch(String(err.errorCode), /ECONNREFUSED/);
        return true;
      }
    );
  });
});
