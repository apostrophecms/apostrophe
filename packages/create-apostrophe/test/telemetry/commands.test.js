import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../../src/core/store.js';
import {
  status, optIn, optOut, preview
} from '../../src/telemetry/commands.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('telemetry/commands — status', function () {
  let dir;
  /** @type {ReturnType<typeof createStore>} */
  let store;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-cmd-'));
    store = createStore({ dir });
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  it('default: unset store, no env', function () {
    const r = status(store, {});
    assert.deepEqual(r, {
      consent: false,
      killSwitchOn: false,
      storedConsent: undefined,
      anonymousId: undefined,
      source: 'default'
    });
  });

  it('stored true: source=stored, id present', function () {
    optIn(store, {});
    const r = status(store, {});
    assert.equal(r.consent, true);
    assert.equal(r.storedConsent, true);
    assert.equal(r.source, 'stored');
    assert.match(r.anonymousId, UUID_RE);
    assert.equal(r.killSwitchOn, false);
  });

  it('kill switch: consent=false, source=kill-switch, stored value reported', function () {
    optIn(store, {});
    const r = status(store, { APOS_TELEMETRY: '0' });
    assert.equal(r.consent, false);
    assert.equal(r.killSwitchOn, true);
    assert.equal(r.storedConsent, true);
    assert.equal(r.source, 'kill-switch');
  });

  it('stored false: source=stored, consent=false', function () {
    optOut(store);
    const r = status(store, {});
    assert.equal(r.consent, false);
    assert.equal(r.storedConsent, false);
    assert.equal(r.source, 'stored');
  });
});

describe('telemetry/commands — optIn', function () {
  let dir;
  /** @type {ReturnType<typeof createStore>} */
  let store;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-cmd-'));
    store = createStore({ dir });
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  it('first time: idGenerated=true; UUID returned', function () {
    const r = optIn(store, {});
    assert.equal(r.consent, true);
    assert.equal(r.idGenerated, true);
    assert.equal(r.killSwitchOn, false);
    assert.match(r.anonymousId, UUID_RE);
  });

  it('second time: idGenerated=false; same id', function () {
    const first = optIn(store, {});
    const second = optIn(store, {});
    assert.equal(second.idGenerated, false);
    assert.equal(second.anonymousId, first.anonymousId);
  });

  it('after opt-out then opt-in: idGenerated=false; id preserved', function () {
    const first = optIn(store, {});
    optOut(store);
    const reon = optIn(store, {});
    assert.equal(reon.idGenerated, false);
    assert.equal(reon.anonymousId, first.anonymousId);
  });

  it('kill switch on: still persists, killSwitchOn flag set', function () {
    const r = optIn(store, { APOS_TELEMETRY: '0' });
    assert.equal(r.consent, true);
    assert.equal(r.killSwitchOn, true);
    // Effective state reflects the override.
    assert.equal(status(store, { APOS_TELEMETRY: '0' }).consent, false);
  });
});

describe('telemetry/commands — optOut', function () {
  let dir;
  /** @type {ReturnType<typeof createStore>} */
  let store;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-cmd-'));
    store = createStore({ dir });
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  it('returns consent=false; preserves anonymousId', function () {
    const on = optIn(store, {});
    const off = optOut(store);
    assert.equal(off.consent, false);
    assert.equal(off.anonymousId, on.anonymousId);
  });

  it('opt-out on unused store: consent=false; anonymousId undefined', function () {
    const r = optOut(store);
    assert.equal(r.consent, false);
    assert.equal(r.anonymousId, undefined);
  });
});

describe('telemetry/commands — preview', function () {
  let dir;
  /** @type {ReturnType<typeof createStore>} */
  let store;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-cmd-'));
    store = createStore({ dir });
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  it('idSentinel=true when no id stored; payload uses zero-UUID', function () {
    const r = preview({
      store,
      cliVersion: '0.1.0',
      env: {}
    });
    assert.equal(r.idSentinel, true);
    assert.equal(r.consent, false);
    assert.equal(r.killSwitchOn, false);
    assert.equal(r.payload.anonymousId, '00000000-0000-0000-0000-000000000000');
    assert.equal(r.payload.event, 'install_success');
  });

  it('idSentinel=false when id stored; payload uses real id', function () {
    const opt = optIn(store, {});
    const r = preview({
      store,
      cliVersion: '0.1.0',
      env: {}
    });
    assert.equal(r.idSentinel, false);
    assert.equal(r.consent, true);
    assert.equal(r.payload.anonymousId, opt.anonymousId);
  });

  it('reports kill-switch + consent state', function () {
    optIn(store, {});
    const r = preview({
      store,
      cliVersion: '0.1.0',
      env: { APOS_TELEMETRY: '0' }
    });
    assert.equal(r.consent, false);
    assert.equal(r.killSwitchOn, true);
  });

  it('sample overrides reach the payload', function () {
    const r = preview({
      store,
      cliVersion: '0.1.0',
      env: {},
      sample: {
        kitId: 'apostrophe-demo',
        dbChoice: 'mongodb',
        packageManager: 'yarn',
        durationMs: 9999
      }
    });
    assert.equal(r.payload.kitId, 'apostrophe-demo');
    assert.equal(r.payload.dbChoice, 'mongodb');
    assert.equal(r.payload.packageManager, 'yarn');
    assert.equal(r.payload.durationMs, 9999);
  });
});
