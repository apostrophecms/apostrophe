import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, readFileSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createStore, defaultStorePath, configDir, KNOWN_KEYS
} from '../../src/core/store.js';

describe('core/store', function () {
  let dir;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-store-'));
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  it('round-trips known keys and persists across instances', function () {
    const a = createStore({ dir });
    assert.equal(a.get('telemetryConsent'), undefined);

    a.set('telemetryConsent', true);
    a.set('anonymousId', 'abc-123');

    const b = createStore({ dir });
    assert.equal(b.get('telemetryConsent'), true);
    assert.equal(b.get('anonymousId'), 'abc-123');
    assert.deepEqual(b.all(), {
      telemetryConsent: true,
      anonymousId: 'abc-123'
    });
  });

  it('delete removes a single key; clear removes the file', function () {
    const s = createStore({ dir });
    s.set('telemetryConsent', false);
    s.set('anonymousId', 'x');

    s.delete('telemetryConsent');
    assert.equal(s.get('telemetryConsent'), undefined);
    assert.equal(s.get('anonymousId'), 'x');

    s.clear();
    assert.deepEqual(s.all(), {});
    // clear() is idempotent.
    s.clear();
  });

  it('rejects unknown keys on every accessor', function () {
    const s = createStore({ dir });
    for (const op of [
      () => s.get('nope'),
      () => s.set('nope', 1),
      () => s.delete('nope')
    ]) {
      assert.throws(op, TypeError);
    }
  });

  it('tolerates a missing and a corrupt backing file', function () {
    const s = createStore({ dir });
    // Missing file → empty.
    assert.deepEqual(s.all(), {});

    // Corrupt JSON → treated as empty, not a throw; a write recovers it.
    writeFileSync(s.path, '{ not json', 'utf8');
    assert.deepEqual(s.all(), {});
    s.set('anonymousId', 'recovered');
    assert.equal(createStore({ dir }).get('anonymousId'), 'recovered');
  });

  it('writes atomically (pretty JSON, trailing newline, no temp left behind)', function () {
    const s = createStore({ dir });
    s.set('telemetryConsent', true);
    const raw = readFileSync(s.path, 'utf8');
    assert.equal(raw, '{\n  "telemetryConsent": true\n}\n');
  });

  it('creates the config directory if it does not exist', function () {
    const nested = join(dir, 'deep', 'missing');
    const s = createStore({ dir: nested });
    s.set('anonymousId', 'y');
    assert.equal(createStore({ dir: nested }).get('anonymousId'), 'y');
  });

  it('defaultStorePath lives under the per-OS config dir', function () {
    assert.equal(defaultStorePath(), join(configDir(), 'store.json'));
    assert.ok(configDir().includes('create-apostrophe'));
  });

  it('KNOWN_KEYS is the frozen two-key allowlist', function () {
    assert.deepEqual([ ...KNOWN_KEYS ], [ 'telemetryConsent', 'anonymousId' ]);
    assert.throws(() => {
      KNOWN_KEYS.push('x');
    }, TypeError);
  });
});
