import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeIfAbsent, upsertEnv } from '../../src/core/env-file.js';

describe('core/env-file', function () {
  let dir;
  let env;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-env-'));
    env = join(dir, '.env');
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  it('writeIfAbsent writes when absent, refuses to clobber', function () {
    assert.equal(writeIfAbsent(env, 'A=1\n'), true);
    assert.equal(readFileSync(env, 'utf8'), 'A=1\n');
    assert.equal(writeIfAbsent(env, 'B=2\n'), false);
    assert.equal(readFileSync(env, 'utf8'), 'A=1\n');
  });

  it('upsertEnv replaces an existing/empty key in place, appends new ones', function () {
    writeFileSync(env, 'A=\nB=keep\n');
    upsertEnv(env, {
      A: 'filled',
      C: 'added'
    });
    assert.equal(readFileSync(env, 'utf8'), 'A=filled\nB=keep\nC=added\n');
  });

  it('upsertEnv quotes values needing it, leaves hex bare', function () {
    upsertEnv(env, {
      HEX: 'deadbeef',
      URI: 'postgres://u:p@h:5432/db?x=1 2',
      HASH: 'a#b'
    });
    const out = readFileSync(env, 'utf8');
    assert.match(out, /^HEX=deadbeef$/m);
    assert.match(out, /^URI="postgres:\/\/u:p@h:5432\/db\?x=1 2"$/m);
    assert.match(out, /^HASH="a#b"$/m);
  });

  it('upsertEnv on a missing file creates it with a trailing newline', function () {
    assert.equal(existsSync(env), false);
    upsertEnv(env, { A: '1' });
    assert.equal(readFileSync(env, 'utf8'), 'A=1\n');
  });
});
