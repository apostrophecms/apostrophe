import assert from 'node:assert/strict';
import { createUmamiTransport } from '../../src/telemetry/transport.js';
import { createTelemetry } from '../../src/telemetry/index.js';
import {
  TELEMETRY_ENDPOINT,
  TELEMETRY_WRITE_KEY,
  TELEMETRY_HOSTNAME
} from '../../src/telemetry/wire-config.js';

// Swap global fetch to observe what the @umami/node client sends.

const SUCCESS_PARTIAL = Object.freeze({
  kitId: 'apostrophe-astro-demo',
  dbChoice: 'sqlite',
  packageManager: 'npm',
  durationMs: 1234
});

function silentLogger() {
  return {
    info() {},
    warn() {}
  };
}

describe('telemetry/transport — createUmamiTransport', function () {
  /** @type {typeof globalThis.fetch} */
  let originalFetch;

  beforeEach(function () {
    originalFetch = globalThis.fetch;
  });
  afterEach(function () {
    globalThis.fetch = originalFetch;
  });

  function recordingFetch(response = {
    ok: true,
    status: 200
  }) {
    /** @type {Array<{ url: string, init: { method: string, body: string } }>} */
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({
        url: String(url),
        init
      });
      return response;
    };
    return calls;
  }

  it('POSTs the payload to <endpoint>/api/send as a Umami event', async function () {
    const calls = recordingFetch();
    const transport = createUmamiTransport({
      endpoint: 'https://umami.example',
      writeKey: 'WEBSITE-XYZ',
      hostname: 'cli.example.com'
    });
    await transport({
      event: 'install_success',
      cliVersion: '0.1.0',
      kitId: 'apostrophe-astro-demo',
      dbChoice: 'sqlite',
      packageManager: 'npm',
      durationMs: 1234,
      anonymousId: 'id-1'
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://umami.example/api/send');
    assert.equal(calls[0].init.method, 'POST');
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.type, 'event');
    assert.equal(body.payload.website, 'WEBSITE-XYZ');
    assert.equal(body.payload.name, 'install_success');
    assert.equal(body.payload.hostname, 'cli.example.com');
    assert.deepEqual(body.payload.data, {
      cliVersion: '0.1.0',
      kitId: 'apostrophe-astro-demo',
      dbChoice: 'sqlite',
      packageManager: 'npm',
      durationMs: 1234,
      anonymousId: 'id-1'
    });
  });

  it('threads install_fail with failStage + errorCode', async function () {
    const calls = recordingFetch();
    const transport = createUmamiTransport({
      endpoint: 'https://umami.example',
      writeKey: 'k',
      hostname: 'cli.example.com'
    });
    await transport({
      event: 'install_fail',
      cliVersion: '0.1.0',
      kitId: 'apostrophe-astro-demo',
      dbChoice: 'sqlite',
      packageManager: 'npm',
      durationMs: 1,
      failStage: 'dependency_install',
      errorCode: 'install_failed'
    });
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.payload.name, 'install_fail');
    assert.equal(body.payload.data.failStage, 'dependency_install');
    assert.equal(body.payload.data.errorCode, 'install_failed');
  });

  it('rejects on non-2xx so the telemetry layer can warn under verbose', async function () {
    recordingFetch({
      ok: false,
      status: 500
    });
    const transport = createUmamiTransport({
      endpoint: 'https://umami.example',
      writeKey: 'k',
      hostname: 'cli.example.com'
    });
    await assert.rejects(
      () => transport({
        event: 'install_success',
        ...SUCCESS_PARTIAL,
        cliVersion: '0.1.0'
      }),
      /HTTP 500/
    );
  });

  it('propagates fetch network errors', async function () {
    globalThis.fetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const transport = createUmamiTransport({
      endpoint: 'https://nope.example',
      writeKey: 'k',
      hostname: 'cli.example.com'
    });
    await assert.rejects(
      () => transport({
        event: 'install_fail',
        ...SUCCESS_PARTIAL,
        cliVersion: '0.1.0',
        failStage: 'clone',
        errorCode: 'git_clone_failed'
      }),
      /ECONNREFUSED/
    );
  });
});

describe('telemetry/createTelemetry — default live transport (wire-config)', function () {
  /** @type {typeof globalThis.fetch} */
  let originalFetch;

  beforeEach(function () {
    originalFetch = globalThis.fetch;
  });
  afterEach(function () {
    globalThis.fetch = originalFetch;
  });

  it('uses the wire-config live transport when no transport is injected', async function () {
    /** @type {Array<{ url: string, body: string }>} */
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({
        url: String(url),
        body: String(init.body)
      });
      return {
        ok: true,
        status: 200
      };
    };
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      anonymousId: 'id-x',
      logger: silentLogger()
    });
    t.event('install_success', SUCCESS_PARTIAL);
    await t.flush();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${TELEMETRY_ENDPOINT}/api/send`);
    const body = JSON.parse(calls[0].body);
    assert.equal(body.payload.website, TELEMETRY_WRITE_KEY);
    assert.equal(body.payload.hostname, TELEMETRY_HOSTNAME);
  });

  it('consent=false blocks the live transport (no fetch even though wire-config is set)', async function () {
    let fetched = false;
    globalThis.fetch = async () => {
      fetched = true;
      return {
        ok: true,
        status: 200
      };
    };
    const t = createTelemetry({
      consent: false,
      cliVersion: '0.1.0',
      logger: silentLogger()
    });
    t.event('install_success', SUCCESS_PARTIAL);
    await t.flush();
    assert.equal(fetched, false);
  });

  it('an injected transport wins over the wire-config default (test seam)', async function () {
    let fetched = false;
    globalThis.fetch = async () => {
      fetched = true;
      return {
        ok: true,
        status: 200
      };
    };
    /** @type {Array<object>} */
    const sent = [];
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      transport: async (payload) => {
        sent.push(payload);
      },
      logger: silentLogger()
    });
    t.event('install_success', SUCCESS_PARTIAL);
    await t.flush();
    assert.equal(fetched, false);
    assert.equal(sent.length, 1);
  });

  it('config overrides redirect the live transport at a sandbox endpoint', async function () {
    /** @type {Array<{ url: string, body: string }>} */
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({
        url: String(url),
        body: String(init.body)
      });
      return {
        ok: true,
        status: 200
      };
    };
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      endpoint: 'https://umami.sandbox.local',
      writeKey: 'SANDBOX-KEY',
      hostname: 'sandbox.test',
      logger: silentLogger()
    });
    t.event('install_success', SUCCESS_PARTIAL);
    await t.flush();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://umami.sandbox.local/api/send');
    const body = JSON.parse(calls[0].body);
    assert.equal(body.payload.website, 'SANDBOX-KEY');
    assert.equal(body.payload.hostname, 'sandbox.test');
    assert.notEqual(body.payload.website, TELEMETRY_WRITE_KEY);
  });

  it('partial override (writeKey only) falls back to wire-config for the rest', async function () {
    /** @type {Array<{ url: string, body: string }>} */
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({
        url: String(url),
        body: String(init.body)
      });
      return {
        ok: true,
        status: 200
      };
    };
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      writeKey: 'SANDBOX-KEY',
      logger: silentLogger()
    });
    t.event('install_success', SUCCESS_PARTIAL);
    await t.flush();
    assert.equal(calls[0].url, `${TELEMETRY_ENDPOINT}/api/send`);
    const body = JSON.parse(calls[0].body);
    assert.equal(body.payload.website, 'SANDBOX-KEY');
    assert.equal(body.payload.hostname, TELEMETRY_HOSTNAME);
  });

  it('a hanging live transport is bounded by timeoutMs and never throws', async function () {
    globalThis.fetch = () => new Promise(() => {});
    /** @type {Array<string>} */
    const warn = [];
    const t = createTelemetry({
      consent: true,
      cliVersion: '0.1.0',
      timeoutMs: 30,
      verbose: true,
      logger: {
        info() {},
        warn: (m) => warn.push(m)
      }
    });
    const start = Date.now();
    t.event('install_success', SUCCESS_PARTIAL);
    await t.flush();
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 500, `flush took too long: ${elapsed}ms`);
    assert.equal(warn.length, 1);
    assert.match(warn[0], /transport failed/);
    assert.match(warn[0], /timeout/);
  });
});
