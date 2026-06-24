// Single home for the installer's "DB burden": deriving the connection URI,
// a real connection/liveness check with precise failure classification,
// dropping a database, and restoring a JSONL dump. All built on
// @apostrophecms/db-connect — the same library the cloned project's own
// Apostrophe uses — so there is no shell-tool dependency (no mongorestore /
// pg_restore) and the dump + on-disk formats match within a major version.
//
// Core module: the UI may import core, but core must never import UI
// (enforced by test/boundary.test.js).

import path from 'node:path';
import { createRequire } from 'node:module';
import dbConnect from '@apostrophecms/db-connect';
import { assertSafeShortName } from './validate.js';

/** @typedef {import('../index.js').DbChoice} DbChoice */

/**
 * Coarse, telemetry-safe reason for a failed connection. The raw driver
 * message is preserved only for interactive display, never for telemetry.
 * @typedef {('unreachable' | 'auth' | 'unknown')} FailureReason
 */

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * The connection URI core will actually open at runtime. Mirrors
 * @apostrophecms/db's own derivation so anything we restore lands in the
 * exact place the app later reads.
 *
 *   - mongodb / postgres: the user-supplied `dbUri`, verbatim (what we wrote
 *     to APOS_DB_URI).
 *   - sqlite: core's formula.
 *
 * @param {{
 *   dbChoice: DbChoice, dbUri?: string, appRoot: string, shortName: string
 * }} opts
 * @returns {string}
 * @throws {TypeError} for an unsafe shortName, or a mongodb/postgres choice
 *   with no dbUri.
 */
export function resolveDbUri({
  dbChoice, dbUri, appRoot, shortName
}) {
  if (dbChoice === 'sqlite') {
    assertSafeShortName(shortName);
    return `sqlite://${path.resolve(appRoot, 'data', `${shortName}.sqlite`)}`;
  }
  if (!dbUri) {
    throw new TypeError(`resolveDbUri: ${dbChoice} requires a dbUri.`);
  }
  return dbUri;
}

/**
 * The freshly-installed project's own `@apostrophecms/db-connect`, so any
 * post-install sqlite work runs against the same driver the app will use —
 * i.e. the `better-sqlite3` the project's `allowScripts` block actually built.
 * create-apostrophe's own `better-sqlite3` is never built in npx / global
 * installs (no project root → `allowScripts` doesn't apply), so its bundled
 * copy must never construct a sqlite database.
 *
 * db-connect is resolved the way the project's Apostrophe resolves it
 * (Apostrophe depends on it directly), so it is found whether npm hoisted it
 * to the project root or nested it under `apostrophe`. All sqlite operations
 * in this installer happen *after* the project install, so the module is
 * always present by the time this is called.
 *
 * Returns `fallback` (the bundled copy) when the project module can't be
 * resolved.
 *
 * @param {string} appRoot  Installed app root (where node_modules/apostrophe lives).
 * @param {{ fallback?: typeof dbConnect }} [opts]
 * @returns {typeof dbConnect}
 */
export function loadProjectDbConnect(appRoot, { fallback = dbConnect } = {}) {
  try {
    const requireFromApp = createRequire(path.join(appRoot, 'package.json'));
    const apostropheEntry = requireFromApp.resolve('apostrophe');
    const requireFromApostrophe = createRequire(apostropheEntry);
    return requireFromApostrophe('@apostrophecms/db-connect');
  } catch {
    return fallback;
  }
}

/**
 * Open a real connection and report reachability plus whether the database
 * already holds data. `listCollections().toArray()` is a genuine round-trip,
 * so it doubles as the liveness probe and the existing-data check.
 *
 * Uniform across every adapter.
 * Never throws — failures are classified into a {@link FailureReason}.
 *
 * @param {string} uri
 * @param {{ timeoutMs?: number, connect?: typeof dbConnect }} [opts]
 * @returns {Promise<{
 *   reachable: boolean,
 *   empty: boolean,
 *   collectionCount: number,
 *   reason?: FailureReason,
 *   message?: string
 * }>}
 */
export async function inspect(
  uri,
  { timeoutMs = DEFAULT_TIMEOUT_MS, connect = dbConnect } = {}
) {
  let client;
  try {
    client = await connect(uri, connectOptions(uri, timeoutMs));
    const collections = await client.db().listCollections().toArray();
    const collectionCount = collections.length;
    return {
      reachable: true,
      empty: collectionCount === 0,
      collectionCount
    };
  } catch (err) {
    return {
      reachable: false,
      empty: false,
      collectionCount: 0,
      reason: classify(err),
      message: messageOf(err)
    };
  } finally {
    await closeQuietly(client);
  }
}

/**
 * Reachability/auth verdict only — emptiness ignored. For callers that just
 * need to know the connection is usable.
 *
 * @param {string} uri
 * @param {{ timeoutMs?: number, connect?: typeof dbConnect }} [opts]
 * @returns {Promise<{ reachable: boolean, reason?: FailureReason, message?: string }>}
 */
export async function checkConnection(uri, opts) {
  const {
    reachable, reason, message
  } = await inspect(uri, opts);
  return reachable
    ? { reachable }
    : {
      reachable,
      reason,
      message
    };
}

/**
 * Drop the whole database — the guaranteed clean slate behind an explicit
 * "start fresh" / "overwrite" consent. Mongo drops the database; postgres
 * drops the collection tables / schema; sqlite drops all tables (the file
 * itself remains). Restore alone clears only the dump's own collections, so
 * this is the separate step that removes orphan collections from prior data.
 *
 * @param {string} uri
 * @param {{ connect?: typeof dbConnect }} [opts]
 * @returns {Promise<void>}
 */
export async function dropDatabase(uri, { connect = dbConnect } = {}) {
  let client;
  try {
    client = await connect(uri);
    await client.db().dropDatabase();
  } finally {
    await closeQuietly(client);
  }
}

/**
 * Empty every existing collection (per-collection `deleteMany`) without
 * dropping the database. Privilege-safe — needs only the `readWrite`/DELETE
 * rights {@link restore} uses (no `dbAdmin`/DROP), so it works on a
 * locked-down Atlas/SRV user. Unlike a bare {@link restore} (which clears
 * only the dump's own collections) it also empties orphan collections the
 * dump doesn't carry. No-op on an empty/fresh target.
 *
 * @param {string} uri
 * @param {{ connect?: typeof dbConnect }} [opts]
 * @returns {Promise<void>}
 */
export async function clearDatabase(uri, { connect = dbConnect } = {}) {
  let client;
  try {
    client = await connect(uri);
    const db = client.db();
    const collections = await db.listCollections().toArray();
    for (const { name } of collections) {
      // Mongo system collections aren't writable and aren't ours to touch.
      if (name.startsWith('system.')) {
        continue;
      }
      await db.collection(name).deleteMany({});
    }
  } finally {
    await closeQuietly(client);
  }
}

/**
 * Restore a JSONL dump into the target DB. Thin wrapper over db-connect's
 * `restore`, which clears only the dump's own collections — to also clear
 * orphans, call {@link clearDatabase} first ({@link dropDatabase} is the hard
 * reset). The sqlite adapter creates the db file and its parent directories
 * on connect, so there is nothing for us to pre-create.
 *
 * @param {string} uri
 * @param {(
 *   import('node:stream').Readable | string |
 *   Iterable<string> | AsyncIterable<string>
 * )} source
 *   JSONL lines: a Readable stream (e.g. a yauzl entry), a string, or an
 *   (async) iterable of lines.
 * @param {{ restore?: typeof dbConnect.restore }} [opts]
 * @returns {Promise<void>}
 */
export async function restore(
  uri,
  source,
  { restore: restoreImpl = dbConnect.restore } = {}
) {
  await restoreImpl(uri, source);
}

/**
 * Per-engine connect options carrying a bounded selection timeout so an
 * unreachable host fails fast instead of hanging the prompt. Unknown keys
 * are ignored by the other engine's driver, but we branch to stay precise.
 * @param {string} uri
 * @param {number} timeoutMs
 * @returns {object}
 */
function connectOptions(uri, timeoutMs) {
  if (/^postgres(ql)?:|^multipostgres:/i.test(uri)) {
    return { connectionTimeoutMillis: timeoutMs };
  }
  return { serverSelectionTimeoutMS: timeoutMs };
}

/**
 * Map a driver error to a coarse {@link FailureReason}. Symbolic only — the
 * raw message never reaches this verdict.
 * @param {any} err
 * @returns {FailureReason}
 */
function classify(err) {
  const code = err?.code;
  const message = messageOf(err);
  // Bad credentials: mongo AuthenticationFailed (code 18 / codeName), or
  // postgres invalid_password (28P01) / invalid_authorization (28000).
  if (
    code === 18 ||
    err?.codeName === 'AuthenticationFailed' ||
    code === '28P01' ||
    code === '28000' ||
    /authentication failed/i.test(message)
  ) {
    return 'auth';
  }
  // Cannot reach the server: refused, DNS failure, server-selection timeout.
  if (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    err?.name === 'MongoServerSelectionError' ||
    /server selection/i.test(message) ||
    /timed out/i.test(message)
  ) {
    return 'unreachable';
  }
  return 'unknown';
}

/**
 * @param {any} err
 * @returns {string}
 */
function messageOf(err) {
  return (err && err.message) ? err.message : String(err);
}

/**
 * Close a client if one was opened, swallowing close-time errors so they
 * never mask the original outcome.
 * @param {{ close?: () => Promise<void> } | undefined} client
 * @returns {Promise<void>}
 */
async function closeQuietly(client) {
  if (client && typeof client.close === 'function') {
    try {
      await client.close();
    } catch {
      // A failed close must not override the success/failure we already have.
    }
  }
}
