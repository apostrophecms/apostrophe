import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../../src/core/store.js';
import {
  isKillSwitchOn, readConsent, setConsent, getAnonymousId, forgetIdentity,
  previewPayload
} from '../../src/telemetry/consent.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('telemetry/consent — kill switch', function () {
  it('only the literal "0" disables', function () {
    assert.equal(isKillSwitchOn({ APOS_TELEMETRY: '0' }), true);
    assert.equal(isKillSwitchOn({ APOS_TELEMETRY: '1' }), false);
    assert.equal(isKillSwitchOn({ APOS_TELEMETRY: 'false' }), false);
    assert.equal(isKillSwitchOn({ APOS_TELEMETRY: '' }), false);
    assert.equal(isKillSwitchOn({}), false);
  });
});

describe('telemetry/consent — precedence', function () {
  let dir;
  /** @type {ReturnType<typeof createStore>} */
  let store;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-consent-'));
    store = createStore({ dir });
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  it('unset store + no env → false (opt-in only, no default)', function () {
    assert.equal(readConsent(store, {}), false);
  });

  it('stored true, no env → true', function () {
    store.set('telemetryConsent', true);
    assert.equal(readConsent(store, {}), true);
  });

  it('stored false, no env → false', function () {
    store.set('telemetryConsent', false);
    assert.equal(readConsent(store, {}), false);
  });

  it('stored true, kill switch on → false (env beats store)', function () {
    store.set('telemetryConsent', true);
    assert.equal(readConsent(store, { APOS_TELEMETRY: '0' }), false);
  });

  it('stored false, kill switch on → still false', function () {
    store.set('telemetryConsent', false);
    assert.equal(readConsent(store, { APOS_TELEMETRY: '0' }), false);
  });

  it('only boolean true is "on"; truthy strings/numbers are ignored', function () {
    // Direct store poke — bypasses setConsent's TypeError guard.
    store.set('telemetryConsent', /** @type {any} */ ('yes'));
    assert.equal(readConsent(store, {}), false);
  });
});

describe('telemetry/consent — identity lifecycle', function () {
  let dir;
  /** @type {ReturnType<typeof createStore>} */
  let store;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-consent-'));
    store = createStore({ dir });
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  it('getAnonymousId returns undefined until first opt-in', function () {
    assert.equal(getAnonymousId(store), undefined);
  });

  it('first opt-in generates a UUID and persists it', function () {
    const r = setConsent(store, true);
    assert.match(r.anonymousId, UUID_RE);
    assert.equal(getAnonymousId(store), r.anonymousId);
  });

  it('opt-out preserves the id (stable across toggles)', function () {
    const onR = setConsent(store, true);
    const id = onR.anonymousId;
    setConsent(store, false);
    assert.equal(getAnonymousId(store), id);
    // And a later opt-in reuses it — no new generation.
    const reonR = setConsent(store, true);
    assert.equal(reonR.anonymousId, id);
  });

  it('a second opt-in with an id already present does not regenerate', function () {
    setConsent(store, true);
    const id = getAnonymousId(store);
    setConsent(store, true);
    assert.equal(getAnonymousId(store), id);
  });

  it('setConsent rejects non-boolean (programmer error)', function () {
    assert.throws(
      () => setConsent(store, /** @type {any} */ ('on')),
      TypeError
    );
    assert.throws(
      () => setConsent(store, /** @type {any} */ (1)),
      TypeError
    );
  });

  it('forgetIdentity wipes both consent and id', function () {
    setConsent(store, true);
    forgetIdentity(store);
    assert.equal(readConsent(store, {}), false);
    assert.equal(getAnonymousId(store), undefined);
  });

  it('opt-in survives a fresh store instance (persisted on disk)', function () {
    setConsent(store, true);
    const id = getAnonymousId(store);
    const reopened = createStore({ dir });
    assert.equal(getAnonymousId(reopened), id);
    assert.equal(readConsent(reopened, {}), true);
  });
});

describe('telemetry/consent — previewPayload', function () {
  let dir;
  /** @type {ReturnType<typeof createStore>} */
  let store;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-consent-'));
    store = createStore({ dir });
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  it('uses the stored id when one exists', function () {
    setConsent(store, true);
    const id = getAnonymousId(store);
    const p = previewPayload({
      store,
      cliVersion: '0.1.0'
    });
    assert.equal(p.anonymousId, id);
  });

  it('uses the zero-UUID sentinel when no id stored', function () {
    const p = previewPayload({
      store,
      cliVersion: '0.1.0'
    });
    assert.equal(p.anonymousId, '00000000-0000-0000-0000-000000000000');
  });

  it('payload is a real install_success — same shape the wire sees', function () {
    const p = previewPayload({
      store,
      cliVersion: '0.1.0'
    });
    assert.equal(p.event, 'install_success');
    assert.equal(p.cliVersion, '0.1.0');
    assert.equal(p.kitId, 'apostrophe-astro-demo');
    assert.equal(p.dbChoice, 'sqlite');
    assert.equal(p.packageManager, 'npm');
    assert.equal(p.durationMs, 0);
  });

  it('sample overrides take effect', function () {
    const p = previewPayload({
      store,
      cliVersion: '9.9.9',
      sample: {
        kitId: 'apostrophe-essentials',
        dbChoice: 'postgres',
        packageManager: 'pnpm',
        durationMs: 5000
      }
    });
    assert.equal(p.kitId, 'apostrophe-essentials');
    assert.equal(p.dbChoice, 'postgres');
    assert.equal(p.packageManager, 'pnpm');
    assert.equal(p.durationMs, 5000);
  });
});
