// The PII firewall is THE privacy guarantee. These tests do not exercise
// internal mechanics — they assert the externally observable invariant:
// nothing outside the §7 allowlist can ever leave the package. If a future
// refactor breaks the firewall, this file is the alarm.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../../src/core/store.js';
import { createTelemetry } from '../../src/telemetry/index.js';
import { previewPayload, setConsent } from '../../src/telemetry/consent.js';
import { preview } from '../../src/telemetry/commands.js';
import { allowedFields } from '../../src/telemetry/schema.js';

/**
 * Exhaustive sampler of values that must NEVER appear on a payload, drawn
 * from the explicit exclusions doc 03 lists and from the createProject
 * inputs that surround the telemetry call. Each is paired with a key name
 * a careless implementation might use.
 */
const FORBIDDEN_INPUTS = Object.freeze({
  // Identity / personal
  email: 'ceo@example.com',
  name: 'Real Person Name',
  login: 'admin@example.com',
  username: 'reactor-core',
  password: 'hunter2',
  // Network / hosts / paths
  ip: '203.0.113.42',
  hostname: 'db.internal.example.com',
  cwd: '/home/jane/secret-startup',
  projectDir: '/home/jane/secret-startup/my-app',
  appRoot: '/home/jane/secret-startup/my-app/backend',
  // Project specifics
  shortName: 'top-secret-project',
  projectName: 'Top Secret Project',
  // DB connections / credentials
  dbUri: 'mongodb://admin:hunter2@db.internal:27017/secret',
  postgresUri: 'postgres://x:y@db.internal:5432/secret',
  connectionString: 'sqlite:./local.db',
  // Env / secrets / tokens
  env: { APOS_SESSION_SECRET: 'A'.repeat(64) },
  APOS_SESSION_SECRET: 'A'.repeat(64),
  authorization: 'Bearer leaked.jwt.token',
  token: 'gho_fakeghtoken',
  // Git / source
  gitRemote: 'git@github.com:secret-org/secret-repo.git',
  // Free-form raw error blobs the orchestrator must never forward
  rawError: 'ENOENT: no such file or directory, open ' +
    '/home/jane/.npm-cache/locks/staging.lock',
  stack: 'Error: boom\n    at /home/jane/secret-startup/...'
});

const VALID_PARTIAL = Object.freeze({
  kitId: 'apostrophe-astro-demo',
  dbChoice: 'sqlite',
  packageManager: 'npm',
  durationMs: 1234
});

const VALID_FAIL_PARTIAL = Object.freeze({
  ...VALID_PARTIAL,
  failStage: /** @type {const} */ ('dependency_install'),
  errorCode: 'install_failed'
});

/**
 * Run the telemetry hook end-to-end with a poisoned partial payload, return
 * what the transport actually saw.
 */
async function emitAndCapture(event, poisonedPartial) {
  /** @type {Array<Record<string, unknown>>} */
  const sent = [];
  const t = createTelemetry({
    consent: true,
    cliVersion: '0.1.0',
    anonymousId: '22222222-2222-2222-2222-222222222222',
    transport: async (p) => {
      sent.push(p);
    },
    logger: {
      info() {},
      warn() {}
    }
  });
  t.event(event, poisonedPartial);
  await t.flush();
  return sent;
}

describe('PII firewall — install_success', function () {
  it('a payload poisoned with every excluded field still emits the §7 keys only', async function () {
    const sent = await emitAndCapture('install_success', {
      ...VALID_PARTIAL,
      ...FORBIDDEN_INPUTS
    });
    assert.equal(sent.length, 1);
    const allowed = new Set(allowedFields('install_success'));
    for (const k of Object.keys(sent[0])) {
      assert.ok(
        allowed.has(k),
        `forbidden key reached wire: ${k}`
      );
    }
    // Spot-check: every forbidden key is absent.
    for (const k of Object.keys(FORBIDDEN_INPUTS)) {
      assert.equal(k in sent[0], false, `${k} leaked`);
    }
  });

  it('the JSON serialized wire payload contains none of the forbidden VALUES', async function () {
    const sent = await emitAndCapture('install_success', {
      ...VALID_PARTIAL,
      ...FORBIDDEN_INPUTS
    });
    const wire = JSON.stringify(sent[0]);
    const checks = [
      'ceo@example.com',
      'Real Person Name',
      'admin@example.com',
      'reactor-core',
      'hunter2',
      '203.0.113.42',
      'db.internal.example.com',
      '/home/jane',
      'top-secret-project',
      'Top Secret Project',
      'mongodb://admin',
      'postgres://x:y',
      'sqlite:./local.db',
      'APOS_SESSION_SECRET',
      'AAAAAAAA',
      'Bearer leaked',
      'gho_fakeghtoken',
      'github.com:secret-org',
      'ENOENT: no such file',
      '.npm-cache/locks',
      'Error: boom'
    ];
    for (const needle of checks) {
      assert.equal(
        wire.includes(needle), false,
        `forbidden substring leaked into wire payload: ${needle}\n${wire}`
      );
    }
  });
});

describe('PII firewall — install_fail', function () {
  it('poisoned fail payload emits only allowed keys; unknown errorCode dropped', async function () {
    const sent = await emitAndCapture('install_fail', {
      ...VALID_FAIL_PARTIAL,
      errorCode: 'EACCES /home/jane/.npm: permission denied',
      ...FORBIDDEN_INPUTS
    });
    assert.equal(sent.length, 1);
    const allowed = new Set(allowedFields('install_fail'));
    for (const k of Object.keys(sent[0])) {
      assert.ok(allowed.has(k), `forbidden key reached wire: ${k}`);
    }
    // Unknown errorCode is dropped, but the rest of the payload still emits.
    assert.equal('errorCode' in sent[0], false);
    assert.equal(sent[0].failStage, 'dependency_install');
  });

  it('JSON wire payload contains no forbidden values (errorCode path)', async function () {
    const sent = await emitAndCapture('install_fail', {
      ...VALID_FAIL_PARTIAL,
      errorCode: 'EACCES /home/jane/.npm: permission denied',
      ...FORBIDDEN_INPUTS
    });
    const wire = JSON.stringify(sent[0]);
    assert.equal(wire.includes('/home/jane'), false);
    assert.equal(wire.includes('permission denied'), false);
  });
});

describe('PII firewall — previewPayload (no wire, but same allowlist)', function () {
  let dir;
  /** @type {ReturnType<typeof createStore>} */
  let store;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-fw-'));
    store = createStore({ dir });
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  it('previewPayload silently ignores forbidden keys on sample', function () {
    setConsent(store, true);
    const p = previewPayload({
      store,
      cliVersion: '0.1.0',
      // @ts-expect-error — intentionally poisoned sample
      sample: {
        ...FORBIDDEN_INPUTS,
        kitId: 'apostrophe-demo',
        dbChoice: 'postgres',
        packageManager: 'npm',
        durationMs: 1
      }
    });
    const allowed = new Set(allowedFields('install_success'));
    for (const k of Object.keys(p)) {
      assert.ok(allowed.has(k), `forbidden key in preview: ${k}`);
    }
  });

  it('preview() result wraps the same allowlist guarantee', function () {
    const r = preview({
      store,
      cliVersion: '0.1.0',
      env: {},
      // @ts-expect-error — poisoned sample
      sample: {
        ...FORBIDDEN_INPUTS,
        kitId: 'apostrophe-demo',
        dbChoice: 'postgres',
        packageManager: 'npm',
        durationMs: 1
      }
    });
    const allowed = new Set(allowedFields('install_success'));
    for (const k of Object.keys(r.payload)) {
      assert.ok(allowed.has(k), `forbidden key in commands.preview payload: ${k}`);
    }
  });
});

describe('PII firewall — consent gate is a hard wall', function () {
  it('consent=false: not even a verbose log writes the would-be payload', async function () {
    /** @type {Array<string>} */
    const info = [];
    /** @type {Array<string>} */
    const warn = [];
    /** @type {Array<object>} */
    const sent = [];
    const t = createTelemetry({
      consent: false,
      cliVersion: '0.1.0',
      anonymousId: '22222222-2222-2222-2222-222222222222',
      transport: async (p) => {
        sent.push(p);
      },
      logger: {
        info: (m) => info.push(m),
        warn: (m) => warn.push(m)
      },
      verbose: true
    });
    t.event('install_success', {
      ...VALID_PARTIAL,
      ...FORBIDDEN_INPUTS
    });
    await t.flush();
    assert.equal(sent.length, 0);
    // No "would send" log: consent gate short-circuits before any work.
    assert.equal(info.length, 0);
    assert.equal(warn.length, 0);
  });
});
