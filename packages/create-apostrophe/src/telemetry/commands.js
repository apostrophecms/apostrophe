// Headless management surface for telemetry. Handlers the bin wires to argv
// subcommands:
//
//   create-apostrophe [--telemetry-preview]   → see preview()
//   create-apostrophe telemetry status        → see status()
//   create-apostrophe telemetry on            → see optIn()
//   create-apostrophe telemetry off           → see optOut()
//
// Each function returns a structured result; rendering is the UI layer's job.

import {
  isKillSwitchOn,
  readConsent,
  setConsent,
  getAnonymousId,
  previewPayload
} from './consent.js';

/** @typedef {ReturnType<typeof import('../core/store.js').createStore>} Store */
/** @typedef {NodeJS.ProcessEnv}                                        Env   */
/** @typedef {import('./schema.js').SuccessPayload}                     SuccessPayload */

/**
 * @typedef {('kill-switch' | 'stored' | 'default')} StatusSource
 *   - `kill-switch`: `APOS_TELEMETRY=0` is forcing OFF, regardless of store.
 *   - `stored`: store has an explicit `true`/`false`.
 *   - `default`: store is unset (effective value is `false`, opt-in only).
 */

/**
 * @typedef {object} StatusResult
 * @property {boolean}           consent       Effective value the emitter acts on.
 * @property {boolean}           killSwitchOn  `APOS_TELEMETRY=0` is set.
 * @property {boolean|undefined} storedConsent Raw stored value (undefined = unset).
 * @property {string|undefined}  anonymousId   Stored id (undefined until ever opted in).
 * @property {StatusSource}      source        Which input determined `consent`.
 */

/**
 * Read effective telemetry state without changing anything.
 *
 * @param {Store} store
 * @param {Env}   [env]
 * @returns {StatusResult}
 */
export function status(store, env = process.env) {
  const killSwitchOn = isKillSwitchOn(env);
  const raw = store.get('telemetryConsent');
  const storedConsent = typeof raw === 'boolean' ? raw : undefined;
  /** @type {StatusSource} */
  let source;
  if (killSwitchOn) {
    source = 'kill-switch';
  } else if (storedConsent !== undefined) {
    source = 'stored';
  } else {
    source = 'default';
  }
  return {
    consent: readConsent(store, env),
    killSwitchOn,
    storedConsent,
    anonymousId: getAnonymousId(store),
    source
  };
}

/**
 * @typedef {object} OptInResult
 * @property {true}              consent
 * @property {string}            anonymousId  Existing id, or newly generated.
 * @property {boolean}           idGenerated  Whether this call created the id.
 * @property {boolean}           killSwitchOn Persisted setting is overridden by env.
 */

/**
 * Persist opt-in. Generates an `anonymousId` if none exists; reuses the
 * stored one otherwise. The kill switch is reported but does NOT block the
 * write — the user's preference is saved either way, the env wins at
 * emission time.
 *
 * @param {Store} store
 * @param {Env}   [env]
 * @returns {OptInResult}
 */
export function optIn(store, env = process.env) {
  const before = getAnonymousId(store);
  const result = setConsent(store, true);
  const anonymousId = result.anonymousId ?? '';
  return {
    consent: true,
    anonymousId,
    idGenerated: before === undefined && anonymousId.length > 0,
    killSwitchOn: isKillSwitchOn(env)
  };
}

/**
 * @typedef {object} OptOutResult
 * @property {false}             consent
 * @property {string|undefined}  anonymousId  Preserved on opt-out; same value
 *                                            as before, or undefined if none.
 */

/**
 * Persist opt-out. Preserves any existing `anonymousId` so a later opt-in
 * resumes the same identity. Use {@link forgetIdentity} (from consent.js) if
 * you want a full reset — not exposed as a subcommand today.
 *
 * @param {Store} store
 * @returns {OptOutResult}
 */
export function optOut(store) {
  setConsent(store, false);
  return {
    consent: false,
    anonymousId: getAnonymousId(store)
  };
}

/**
 * @typedef {object} PreviewResult
 * @property {SuccessPayload} payload         Exact would-be payload (built via
 *                                            `buildPayload`, no separate code path).
 * @property {boolean}        consent         Effective state at preview time.
 * @property {boolean}        killSwitchOn
 * @property {boolean}        idSentinel      `true` when no real `anonymousId` is
 *                                            stored yet; preview used the
 *                                            placeholder `00000000-…`.
 */

/**
 * Build the would-be payload for `--telemetry-preview`. Sends nothing.
 *
 * @param {{
 *   store: Store,
 *   cliVersion: string,
 *   env?: Env,
 *   sample?: Partial<Pick<import('./schema.js').BasePayloadInput,
 *     'kitId' | 'dbChoice' | 'packageManager' | 'durationMs'>>
 * }} opts
 * @returns {PreviewResult}
 */
export function preview({
  store, cliVersion, env = process.env, sample
}) {
  const payload = previewPayload({
    store,
    cliVersion,
    sample
  });
  return {
    payload,
    consent: readConsent(store, env),
    killSwitchOn: isKillSwitchOn(env),
    idSentinel: getAnonymousId(store) === undefined
  };
}
