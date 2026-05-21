// Telemetry hook constructor. The body merges `cliVersion` + `anonymousId`
// from config into the partial payload, runs `buildPayload` to validate, and
// hands off to `transport`.
//
// Two invariants the test suite enforces:
//   1. event() never throws and never delays the caller (fire-and-forget).
//   2. consent === false makes the hook a true no-op — no payload is built,
//      no transport is invoked, nothing reaches the wire.

import { buildPayload } from './schema.js';
import { createUmamiTransport } from './transport.js';
import {
  TELEMETRY_ENDPOINT,
  TELEMETRY_WRITE_KEY,
  TELEMETRY_HOSTNAME
} from './wire-config.js';

/** @typedef {import('../index.js').TelemetryConfig}        TelemetryConfig        */
/** @typedef {import('../index.js').TelemetryHook}          TelemetryHook          */
/** @typedef {import('../index.js').TelemetryEvent}         TelemetryEvent         */
/** @typedef {import('../index.js').TelemetryEventPayload}  TelemetryEventPayload  */
/** @typedef {import('../index.js').ManagedTelemetryHook}   ManagedTelemetryHook   */
/** @typedef {import('./schema.js').TelemetryPayload}       TelemetryPayload       */
/** @typedef {import('./schema.js').PayloadInput}           PayloadInput           */

/**
 * Async wire transport. Resolves on success, rejects on failure. The default
 * is a no-op; the live transport is injected at construction.
 * @typedef {(payload: TelemetryPayload) => Promise<void>} Transport
 */

/**
 * Minimal logger used for verbose diagnostics. Defaults to `console` so the
 * standalone bin works without wiring.
 * @typedef {object} VerboseLogger
 * @property {(msg: string) => void} info
 * @property {(msg: string) => void} warn
 */

/**
 * Construction-time config. Extends the public {@link TelemetryConfig} with
 * injection seams (`transport`, `timeoutMs`, `logger`) plus `anonymousId`
 * (the caller reads it from the store and threads it in).
 * @typedef {TelemetryConfig & {
 *   anonymousId?: string,
 *   transport?:   Transport,
 *   timeoutMs?:   number,
 *   logger?:      VerboseLogger
 * }} TelemetryConfigExt
 */

const DEFAULT_TIMEOUT_MS = 2000;

/** @type {Transport} */
const noopTransport = async () => {};

/**
 * Caller overrides win per field; missing fields fall through to
 * `wire-config.js`. Empties out to no-op rather than building a broken
 * client when the resolved endpoint or write key is missing.
 *
 * @param {{ endpoint?: string, writeKey?: string, hostname?: string }} overrides
 * @returns {Transport}
 */
function buildDefaultTransport(overrides) {
  const endpoint = overrides.endpoint ?? TELEMETRY_ENDPOINT;
  const writeKey = overrides.writeKey ?? TELEMETRY_WRITE_KEY;
  const hostname = overrides.hostname ?? TELEMETRY_HOSTNAME;
  if (endpoint && writeKey) {
    return createUmamiTransport({
      endpoint,
      writeKey,
      hostname
    });
  }
  return noopTransport;
}

/**
 * Race `promise` against a timer that rejects after `ms`. Used to bound the
 * transport so a slow / hanging network call cannot wedge the CLI.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number}     ms
 * @returns {Promise<T>}
 */
async function withTimeout(promise, ms) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`telemetry: timeout after ${ms}ms`)),
      ms
    );
    timer.unref?.();
  });
  try {
    return await Promise.race([ promise, timeout ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Construct the telemetry hook.
 *
 * @param {TelemetryConfigExt} config
 * @returns {ManagedTelemetryHook}
 */
export function createTelemetry(config) {
  const {
    consent,
    cliVersion,
    anonymousId,
    endpoint,
    writeKey,
    hostname,
    verbose = false,
    transport: injectedTransport,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    logger = console
  } = config;

  const transport = injectedTransport ?? buildDefaultTransport({
    endpoint,
    writeKey,
    hostname
  });

  /**
   * Pending fire-and-forget jobs; `flush()` waits on them.
   * @type {Set<Promise<void>>}
   */
  const inflight = new Set();

  /**
   * Inner async emission. Never rejects: every failure path is caught and
   * (under `verbose`) logged. Callers must not `await` it directly — the
   * outer `event()` registers the job with `inflight` so `flush()` does.
   *
   * @param {TelemetryEvent}        name
   * @param {TelemetryEventPayload} partial
   */
  const emit = async (name, partial) => {
    /** @type {TelemetryPayload} */
    let payload;
    try {
      payload = buildPayload(name, {
        cliVersion,
        anonymousId,
        ...partial
      });
    } catch (err) {
      if (verbose) {
        logger.warn(`telemetry: invalid payload — ${describe(err)}`);
      }
      return;
    }
    if (verbose) {
      logger.info(`telemetry: would send ${JSON.stringify(payload)}`);
    }
    try {
      await withTimeout(transport(payload), timeoutMs);
    } catch (err) {
      if (verbose) {
        logger.warn(`telemetry: transport failed — ${describe(err)}`);
      }
    }
  };

  return {
    /**
     * Fire-and-forget. Returns void synchronously. A `consent === false`
     * hook short-circuits *before* any payload work — no build, no log.
     *
     * @param {TelemetryEvent}        name
     * @param {TelemetryEventPayload} partial
     */
    event(name, partial) {
      if (!consent) {
        return;
      }
      const job = emit(name, partial);
      inflight.add(job);
      job.finally(() => inflight.delete(job));
    },

    /**
     * Resolve once every pending `event()` job has either completed or hit
     * its timeout. Safe to call when nothing is pending.
     */
    async flush() {
      await Promise.allSettled([ ...inflight ]);
    }
  };
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function describe(err) {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
