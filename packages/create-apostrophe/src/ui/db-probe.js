// Dependency-free reachability probe for mongodb / postgres connection
// strings. Catches typos and "server not running" before the user gets
// past the plan-review, when the real drivers aren't yet installed.
// It validates host:port reachability only — not auth, not database
// existence; the install-time db-config stage is the source of truth.

import net from 'node:net';

const DEFAULT_PORT = Object.freeze({
  mongodb: 27017,
  postgres: 5432
});

/**
 * Suggested local development URI. The postgres form pre-fills the
 * conventional `postgres` superuser so the structure is obvious; the
 * user adds `:yourpassword` after `postgres` inline.
 *
 * @param {'mongodb' | 'postgres'} dbChoice
 * @param {string}                 shortName
 * @returns {string}
 */
export function defaultDbUri(dbChoice, shortName) {
  if (dbChoice === 'mongodb') {
    return `mongodb://localhost:27017/${shortName}`;
  }
  return `postgres://postgres@localhost:5432/${shortName}`;
}

/**
 * @typedef {(
 *   | { kind: 'tcp', host: string, port: number }
 *   | { kind: 'skip-srv' }
 *   | { kind: 'unparseable' }
 * )} ParsedEndpoint
 */

/**
 * Parse the host/port out of a `mongodb://` or `postgres://` URI.
 * `mongodb+srv://` is signalled separately — no host:port to probe,
 * so the verifier treats it as "skipped".
 *
 * @param {'mongodb' | 'postgres'} dbChoice
 * @param {string}                 uri
 * @returns {ParsedEndpoint}
 */
export function parseEndpoint(dbChoice, uri) {
  let url;
  try {
    url = new URL(uri);
  } catch {
    return { kind: 'unparseable' };
  }
  if (url.protocol === 'mongodb+srv:') {
    return { kind: 'skip-srv' };
  }
  const host = url.hostname;
  if (!host) {
    return { kind: 'unparseable' };
  }
  const port = url.port
    ? Number.parseInt(url.port, 10)
    : DEFAULT_PORT[dbChoice];
  if (!Number.isFinite(port)) {
    return { kind: 'unparseable' };
  }
  return {
    kind: 'tcp',
    host,
    port
  };
}

/**
 * Bounded TCP connect. Resolves with `{ ok }` plus a short error string on
 * failure. Never throws; the socket is destroyed on every outcome.
 *
 * @param {string} host
 * @param {number} port
 * @param {number} [timeoutMs]
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export function tcpProbe(host, port, timeoutMs = 1500) {
  return new Promise(resolve => {
    const socket = net.createConnection({
      host,
      port
    });
    let settled = false;
    const finish = result => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () => finish({ ok: true }));
    socket.once('error', err => finish({
      ok: false,
      error: err.message
    }));
    socket.setTimeout(timeoutMs, () =>
      finish({
        ok: false,
        error: `timeout after ${timeoutMs}ms`
      })
    );
  });
}

/**
 * @typedef {(
 *   | { ok: true, host: string, port: number }
 *   | { ok: true, skipped: 'srv' }
 *   | { ok: false, host: string, port: number, error: string }
 *   | { ok: false, error: 'unparseable' }
 * )} VerifyResult
 */

/**
 * High-level entry: parse, probe, return a structured result the UI can
 * render. SRV URIs short-circuit to `ok: true` with `skipped: 'srv'`.
 *
 * @param {'mongodb' | 'postgres'} dbChoice
 * @param {string}                 uri
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<VerifyResult>}
 */
export async function verifyDbReachable(dbChoice, uri, opts = {}) {
  const endpoint = parseEndpoint(dbChoice, uri);
  if (endpoint.kind === 'unparseable') {
    return {
      ok: false,
      error: 'unparseable'
    };
  }
  if (endpoint.kind === 'skip-srv') {
    return {
      ok: true,
      skipped: 'srv'
    };
  }
  const probe = await tcpProbe(endpoint.host, endpoint.port, opts.timeoutMs);
  if (probe.ok) {
    return {
      ok: true,
      host: endpoint.host,
      port: endpoint.port
    };
  }
  return {
    ok: false,
    host: endpoint.host,
    port: endpoint.port,
    error: probe.error
  };
}
