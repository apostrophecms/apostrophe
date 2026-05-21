import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createTelemetry } from '../../src/telemetry/index.js';

const PARTIAL = Object.freeze({
  kitId: 'apostrophe-astro-demo',
  dbChoice: 'sqlite',
  packageManager: 'npm',
  durationMs: 1234
});

const PARTIAL_FAIL = Object.freeze({
  ...PARTIAL,
  failStage: /** @type {const} */ ('dependency_install'),
  errorCode: 'install_failed'
});

/** Capture transport calls + log lines. */
function spies() {
  /** @type {Array<object>} */
  const sent = [];
  /** @type {Array<string>} */
  const info = [];
  /** @type {Array<string>} */
  const warn = [];
  return {
    sent,
    info,
    warn,
    transport: async (payload) => {
      sent.push(payload);
    },
    logger: {
      info: (m) => info.push(m),
      warn: (m) => warn.push(m)
    }
  };
}

describe('telemetry/createTelemetry — consent gate', function () {
  it('consent=false makes event() a true no-op (no transport call)', async function () {
    const s = spies();
    const t = createTelemetry({
      consent: false,
      cliVersion: '0.1.0',
      transport: s.transport,
      logger: s.logger,
      verbose: true
    });
    t.event('install_success', PARTIAL);
    await t.flush();
    assert.equal(s.sent.length, 0);
    assert.equal(s.info.length, 0);
    assert.equal(s.warn.length, 0);
  });

  it('consent=true → transport called exactly once with the wire payload', async function () {
    const s = spies();
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      anonymousId: '11111111-1111-1111-1111-111111111111',
      transport: s.transport,
      logger: s.logger
    });
    t.event('install_success', PARTIAL);
    await t.flush();
    assert.equal(s.sent.length, 1);
    assert.deepEqual(s.sent[0], {
      event: 'install_success',
      cliVersion: '0.1.0',
      kitId: PARTIAL.kitId,
      dbChoice: PARTIAL.dbChoice,
      packageManager: PARTIAL.packageManager,
      durationMs: PARTIAL.durationMs,
      anonymousId: '11111111-1111-1111-1111-111111111111'
    });
  });

  it('omits anonymousId when none provided', async function () {
    const s = spies();
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      transport: s.transport,
      logger: s.logger
    });
    t.event('install_success', PARTIAL);
    await t.flush();
    assert.equal('anonymousId' in s.sent[0], false);
  });

  it('install_fail payload threads failStage + allowlisted errorCode', async function () {
    const s = spies();
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      anonymousId: 'id',
      transport: s.transport,
      logger: s.logger
    });
    t.event('install_fail', PARTIAL_FAIL);
    await t.flush();
    assert.equal(s.sent[0].event, 'install_fail');
    assert.equal(s.sent[0].failStage, 'dependency_install');
    assert.equal(s.sent[0].errorCode, 'install_failed');
  });
});

describe('telemetry/createTelemetry — fire-and-forget contract', function () {
  it('event() returns void synchronously (not a thenable)', function () {
    const s = spies();
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      transport: s.transport,
      logger: s.logger
    });
    const ret = t.event('install_success', PARTIAL);
    assert.equal(ret, undefined);
  });

  it('a slow transport does not block event() (returns before transport resolves)', async function () {
    let resolveTransport;
    const slowTransport = () => new Promise((resolve) => {
      resolveTransport = resolve;
    });
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      transport: slowTransport,
      logger: spies().logger
    });
    const start = Date.now();
    t.event('install_success', PARTIAL);
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 50, `event() returned in ${elapsed}ms (should be sync)`);
    // Let the test exit cleanly.
    resolveTransport();
    await t.flush();
  });

  it('schema rejection: never throws to caller; verbose warn fired', async function () {
    const s = spies();
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      transport: s.transport,
      logger: s.logger,
      verbose: true
    });
    // Bad kitId → buildPayload throws SchemaError — must be swallowed.
    t.event('install_success', {
      ...PARTIAL,
      kitId: /** @type {any} */ ('apostrophe-multisite')
    });
    await t.flush();
    assert.equal(s.sent.length, 0);
    assert.equal(s.warn.length, 1);
    assert.match(s.warn[0], /invalid payload/);
  });

  it('schema rejection: verbose=false stays silent (no log lines)', async function () {
    const s = spies();
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      transport: s.transport,
      logger: s.logger
    });
    t.event('install_success', {
      ...PARTIAL,
      kitId: /** @type {any} */ ('apostrophe-multisite')
    });
    await t.flush();
    assert.equal(s.warn.length, 0);
    assert.equal(s.info.length, 0);
  });

  it('transport rejection: never throws to caller; verbose warn fired', async function () {
    const s = spies();
    const failingTransport = async () => {
      throw new Error('connection refused');
    };
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      transport: failingTransport,
      logger: s.logger,
      verbose: true
    });
    t.event('install_success', PARTIAL);
    await t.flush();
    assert.equal(s.warn.length, 1);
    assert.match(s.warn[0], /transport failed/);
    assert.match(s.warn[0], /connection refused/);
  });
});

describe('telemetry/createTelemetry — timeout', function () {
  it('a hanging transport rejects after timeoutMs without throwing to caller', async function () {
    const s = spies();
    const hang = () => new Promise(() => {});
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      transport: hang,
      timeoutMs: 30,
      logger: s.logger,
      verbose: true
    });
    const TOLERANCE_MS = 5;
    const start = performance.now();
    t.event('install_success', PARTIAL);
    await t.flush();
    const elapsed = performance.now() - start;
    assert.ok(
      elapsed >= 30 - TOLERANCE_MS,
      `flush returned in ${elapsed.toFixed(1)}ms (expected ≳ 30)`
    );
    assert.ok(elapsed < 500, `flush took too long: ${elapsed.toFixed(1)}ms`);
    assert.equal(s.warn.length, 1);
    assert.match(s.warn[0], /transport failed/);
    assert.match(s.warn[0], /timeout/);
  });

  it('fast transport beats the timeout; no warn fired', async function () {
    const s = spies();
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      transport: s.transport,
      timeoutMs: 5000,
      logger: s.logger,
      verbose: true
    });
    t.event('install_success', PARTIAL);
    await t.flush();
    assert.equal(s.sent.length, 1);
    // info: "would send" entry; warn: none.
    assert.equal(s.warn.length, 0);
  });
});

describe('telemetry/createTelemetry — flush()', function () {
  it('resolves immediately when nothing is pending', async function () {
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      logger: spies().logger
    });
    const start = Date.now();
    await t.flush();
    assert.ok(Date.now() - start < 20);
  });

  it('waits for all pending jobs', async function () {
    let pending = 0;
    let maxPending = 0;
    const slowTransport = async () => {
      pending++;
      maxPending = Math.max(maxPending, pending);
      await new Promise((resolve) => setTimeout(resolve, 15));
      pending--;
    };
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      transport: slowTransport,
      logger: spies().logger
    });
    t.event('install_success', PARTIAL);
    t.event('install_success', PARTIAL);
    t.event('install_success', PARTIAL);
    // event() invokes transport synchronously up to its first await, so all
    // three are already in-flight before flush starts.
    assert.equal(maxPending, 3);
    assert.equal(pending, 3);
    await t.flush();
    assert.equal(pending, 0);
  });
});

describe('telemetry/createTelemetry — verbose log content', function () {
  it('logs the exact payload that would be sent', async function () {
    const s = spies();
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      anonymousId: 'abc',
      transport: s.transport,
      logger: s.logger,
      verbose: true
    });
    t.event('install_success', PARTIAL);
    await t.flush();
    assert.equal(s.info.length, 1);
    assert.match(s.info[0], /would send/);
    assert.match(s.info[0], /"anonymousId":"abc"/);
    assert.match(s.info[0], /"event":"install_success"/);
  });
});
