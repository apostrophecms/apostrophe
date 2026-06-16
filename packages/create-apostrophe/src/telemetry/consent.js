// Consent + identity surface for telemetry. Owns the rules around when the
// CLI may emit at all (env kill switch beats stored consent), and the stable
// anonymousId tied to consent (generated once on first opt-in, reused on
// subsequent installs, never deleted on opt-out so a later opt-in resumes
// the same identity).
//
// Pure orchestration over `core/store.js`: no I/O of its own beyond the
// store, no transport, no UI imports.

import { randomUUID } from 'node:crypto';
import { buildPayload } from './schema.js';

/** @typedef {ReturnType<typeof import('../core/store.js').createStore>} Store */
/** @typedef {import('./schema.js').SuccessPayload} SuccessPayload      */
/** @typedef {NodeJS.ProcessEnv}                    Env                 */

/**
 * Env var that hard-disables telemetry regardless of stored consent.
 * Only the literal value `'0'` triggers the kill switch — any other value
 * (including `'false'`, `'off'`, unset) defers to the stored value.
 */
const KILL_SWITCH_VAR = 'APOS_TELEMETRY';
const KILL_SWITCH_OFF = '0';

/**
 * True iff the env kill switch is set. The check is intentionally narrow:
 * only `APOS_TELEMETRY=0` counts, so a stray `APOS_TELEMETRY=true` cannot
 * accidentally disable telemetry for a user who opted in.
 *
 * @param {Env} [env]
 * @returns {boolean}
 */
export function isKillSwitchOn(env = process.env) {
  return env[KILL_SWITCH_VAR] === KILL_SWITCH_OFF;
}

/**
 * Effective consent: the value the emitter should actually act on. Env beats
 * store; unset store is `false` (opt-in only — no preselected default).
 *
 * @param {Store} store
 * @param {Env}   [env]
 * @returns {boolean}
 */
export function readConsent(store, env = process.env) {
  if (isKillSwitchOn(env)) {
    return false;
  }
  return store.get('telemetryConsent') === true;
}

/**
 * Persist the user's choice. On a transition into `true` (from `false` or
 * unset) generate a fresh `anonymousId` if none exists. Going off does NOT
 * clear the id — a later on/off/on cycle keeps stable identity for the user
 * who once consented. To fully wipe identity, call {@link forgetIdentity}.
 *
 * @param {Store}   store
 * @param {boolean} value
 * @returns {{ consent: boolean, anonymousId: string | undefined }} the new
 *   effective state of the store (anonymousId is `undefined` only when
 *   consent is being set to `false` and none has ever been generated).
 */
export function setConsent(store, value) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`setConsent: expected boolean, got ${typeof value}`);
  }
  store.set('telemetryConsent', value);
  let anonymousId = getAnonymousId(store);
  if (value && !anonymousId) {
    anonymousId = randomUUID();
    store.set('anonymousId', anonymousId);
  }
  return {
    consent: value,
    anonymousId
  };
}

/**
 * Read the stored anonymous id without generating one. Returns `undefined`
 * until the user has opted in at least once.
 *
 * @param {Store} store
 * @returns {string | undefined}
 */
export function getAnonymousId(store) {
  const id = store.get('anonymousId');
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

/**
 * Wipe both consent and the anonymous id. Used by the `telemetry off`
 * command when we want a full reset (caller's policy) and by tests.
 *
 * @param {Store} store
 */
export function forgetIdentity(store) {
  store.delete('telemetryConsent');
  store.delete('anonymousId');
}

/**
 * Placeholder values used by {@link previewPayload} when the caller has not
 * yet made their selections (e.g. `--telemetry-preview` invoked standalone).
 * They are valid enum values so the schema accepts them; the *shape* of the
 * payload is what the preview is meant to demonstrate.
 * @type {Required<Pick<import('./schema.js').BasePayloadInput,
 *   'kitId' | 'dbChoice' | 'packageManager' | 'durationMs'>>}
 */
const PREVIEW_DEFAULTS = Object.freeze({
  kitId: 'apostrophe-astro-demo',
  dbChoice: 'sqlite',
  packageManager: 'npm',
  durationMs: 0
});

/**
 * Build the exact payload the CLI would emit for an `install_success`
 * event, suitable for printing to the user. Uses the real `anonymousId` if
 * one is stored; otherwise a sentinel string the UI can render as
 * "(will be generated on opt-in)". Goes through {@link buildPayload}, so
 * the result is field-for-field what the live emitter would send — there is
 * no separate "preview" code path that could drift.
 *
 * @param {{
 *   store: Store,
 *   cliVersion: string,
 *   sample?: Partial<Pick<import('./schema.js').BasePayloadInput,
 *     'kitId' | 'dbChoice' | 'packageManager' | 'durationMs'>>
 * }} opts
 * @returns {SuccessPayload}
 */
export function previewPayload({
  store, cliVersion, sample = {}
}) {
  return buildPayload('install_success', {
    cliVersion,
    anonymousId: getAnonymousId(store) ?? '00000000-0000-0000-0000-000000000000',
    kitId: sample.kitId ?? PREVIEW_DEFAULTS.kitId,
    dbChoice: sample.dbChoice ?? PREVIEW_DEFAULTS.dbChoice,
    packageManager: sample.packageManager ?? PREVIEW_DEFAULTS.packageManager,
    durationMs: sample.durationMs ?? PREVIEW_DEFAULTS.durationMs
  });
}
