// Telemetry payload builder + validators. The privacy guarantee lives here:
// payloads are constructed from a closed allowlist of fields with closed
// enum values, so it is structurally impossible to attach an excluded field
// (email, paths, project name, dbUri, env, …) — even by accident from an
// upstream caller passing extra keys.

import { KIT_IDS } from '../core/kits.js';
import { CUSTOM_KIT_ID } from '../core/starter.js';

/**
 * kitId values accepted on the wire: the six registry kits plus the `'custom'`
 * sentinel a `--starter` install reports. Kept separate from {@link KIT_IDS} so
 * the registry stays exactly the six known kits while telemetry can still say
 * "a custom starter was used" without naming the (potentially private) repo.
 * @type {ReadonlyArray<string>}
 */
const TELEMETRY_KIT_IDS = Object.freeze([ ...KIT_IDS, CUSTOM_KIT_ID ]);

/** @typedef {import('../index.js').KitId}           KitId           */
/** @typedef {import('../index.js').DbChoice}        DbChoice        */
/** @typedef {import('../index.js').PackageManager}  PackageManager  */
/** @typedef {import('../index.js').FailStage}       FailStage       */
/** @typedef {import('../index.js').TelemetryEvent}  TelemetryEvent  */

/**
 * Symbolic error codes. Each value corresponds to a single
 * `throw new StageError(..., { code })` site (or the preflight
 * `UnsupportedPackageManagerError`). Not a contract type — internal to
 * the schema, mirrored from grep'ing `src/core/steps/*` + `errors.js`.
 * @typedef {(
 *   'unsupported_pm' |
 *   'target_exists' |
 *   'git_missing' | 'git_spawn_failed' | 'git_clone_failed' |
 *   'missing_scaffold_file' | 'scaffold_io' |
 *   'npm_missing' | 'npm_spawn_failed' | 'install_failed' | 'apostrophe_missing' |
 *   'db_unreachable' | 'db_auth_failed' | 'db_connect_failed' | 'db_drop_failed' |
 *   'seed_manifest_invalid' | 'seed_download_failed' | 'seed_checksum_failed' |
 *   'seed_unpack_failed' | 'seed_clear_failed' | 'seed_restore_failed' |
 *   'seed_uploads_failed' |
 *   'node_missing' | 'node_spawn_failed' | 'admin_user_failed'
 * )} ErrorCode
 */

/** @type {ReadonlyArray<TelemetryEvent>} */
export const EVENT_NAMES = Object.freeze([ 'install_success', 'install_fail' ]);

/** @type {ReadonlyArray<DbChoice>} */
export const DB_CHOICES = Object.freeze([ 'sqlite', 'mongodb', 'postgres' ]);

/** @type {ReadonlyArray<PackageManager>} */
export const PACKAGE_MANAGERS = Object.freeze([
  'npm', 'pnpm', 'yarn', 'unknown'
]);

/**
 * FailStage enum, in array form so the validator can `.includes(null)`
 * directly against either a string or `null` (preflight).
 * @type {ReadonlyArray<FailStage>}
 */
export const FAIL_STAGES = Object.freeze([
  'clone', 'dependency_install', 'db_connect', 'scaffold', 'sample_data',
  'admin', 'unknown', null
]);

/**
 * Strict allowlist of symbolic error codes the orchestrator may attach to a
 * payload. Adding a new throw site means adding the code here. Unknown codes
 * are dropped from the payload — never pass raw error strings.
 * @type {ReadonlyArray<ErrorCode>}
 */
export const ERROR_CODES = Object.freeze([
  'unsupported_pm',
  'target_exists',
  'git_missing', 'git_spawn_failed', 'git_clone_failed',
  'missing_scaffold_file', 'scaffold_io',
  'npm_missing', 'npm_spawn_failed', 'install_failed', 'apostrophe_missing',
  'db_unreachable', 'db_auth_failed', 'db_connect_failed', 'db_drop_failed',
  'seed_manifest_invalid', 'seed_download_failed', 'seed_checksum_failed',
  'seed_unpack_failed', 'seed_clear_failed', 'seed_restore_failed',
  'seed_uploads_failed',
  'node_missing', 'node_spawn_failed', 'admin_user_failed'
]);

/** @type {ReadonlySet<string>} */
const ERROR_CODE_SET = new Set(ERROR_CODES);

/**
 * Type-guard: narrows a permissive `string` (contract) to the strict
 * {@link ErrorCode} allowlist. Used by {@link buildPayload} to drop unknown
 * codes without leaking raw error strings into the wire payload.
 * @param {string} code
 * @returns {code is ErrorCode}
 */
function isErrorCode(code) {
  return ERROR_CODE_SET.has(code);
}

/**
 * Shared fields every payload carries, regardless of event. `anonymousId` is
 * optional at the schema level: consent.js generates and threads it on opt-in,
 * but the schema only enforces shape and stays decoupled from generation.
 * @typedef {object} BasePayloadInput
 * @property {string}          cliVersion
 * @property {string}          [anonymousId]
 * @property {KitId}           kitId
 * @property {DbChoice}        dbChoice
 * @property {PackageManager}  packageManager
 * @property {number}          durationMs
 */

/**
 * Additional input fields for `install_fail`. `errorCode` is typed `string`
 * here — the schema validates it against {@link ERROR_CODES} at runtime and
 * silently drops unknown values, so the contract stays permissive while the
 * wire stays strict.
 * @typedef {object} FailPayloadInputFields
 * @property {FailStage} failStage
 * @property {string}    [errorCode]
 */

/**
 * Additional output fields for `install_fail` — `errorCode` is narrowed to
 * the {@link ErrorCode} allowlist (unknown values are dropped at build time).
 * @typedef {object} FailPayloadFields
 * @property {FailStage} failStage
 * @property {ErrorCode} [errorCode]
 */

/**
 * Input the builder accepts. Anything outside this allowlist is ignored —
 * the builder copies only from this set.
 * @typedef {BasePayloadInput & Partial<FailPayloadInputFields>} PayloadInput
 */

/**
 * Outgoing payload for `install_success` — base + `event`.
 * @typedef {BasePayloadInput & { event: 'install_success' }} SuccessPayload
 */

/**
 * Outgoing payload for `install_fail` — base + fail fields + `event`.
 * @typedef {BasePayloadInput & FailPayloadFields & { event: 'install_fail' }} FailPayload
 */

/** @typedef {SuccessPayload | FailPayload} TelemetryPayload */

class SchemaError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'SchemaError';
  }
}

/**
 * @template T
 * @param {string} name
 * @param {unknown} value
 * @param {ReadonlyArray<T>} allowed
 * @returns {asserts value is T}
 */
function requireOneOf(name, value, allowed) {
  if (!allowed.includes(/** @type {T} */ (value))) {
    throw new SchemaError(`Invalid ${name}: ${JSON.stringify(value)}`);
  }
}

/**
 * @param {string} name
 * @param {unknown} value
 * @returns {asserts value is string}
 */
function requireString(name, value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new SchemaError(`Invalid ${name}: expected non-empty string`);
  }
}

/**
 * @param {string} name
 * @param {unknown} value
 * @returns {asserts value is number}
 */
function requireFiniteNumber(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SchemaError(`Invalid ${name}: expected finite number`);
  }
}

/**
 * @overload
 * @param {'install_success'} event
 * @param {PayloadInput} input
 * @returns {SuccessPayload}
 */
/**
 * @overload
 * @param {'install_fail'} event
 * @param {PayloadInput} input
 * @returns {FailPayload}
 */
/**
 * @overload
 * @param {TelemetryEvent} event
 * @param {PayloadInput} input
 * @returns {TelemetryPayload}
 */
/**
 * Build a validated payload for one of the two events. Strictly allowlisted:
 * only fields from {@link BasePayloadInput} (and, for fail, {@link FailPayloadFields})
 * appear on the result.
 *
 * @param {TelemetryEvent} event
 * @param {PayloadInput} input
 * @returns {TelemetryPayload}
 * @throws {SchemaError} for an invalid enum value, missing required field,
 *   or wrong type.
 */
export function buildPayload(event, input) {
  requireOneOf('event', event, EVENT_NAMES);
  requireString('cliVersion', input.cliVersion);
  requireOneOf('kitId', input.kitId, TELEMETRY_KIT_IDS);
  requireOneOf('dbChoice', input.dbChoice, DB_CHOICES);
  requireOneOf('packageManager', input.packageManager, PACKAGE_MANAGERS);
  requireFiniteNumber('durationMs', input.durationMs);
  if (input.anonymousId !== undefined) {
    requireString('anonymousId', input.anonymousId);
  }

  /** @type {BasePayloadInput} */
  const base = {
    cliVersion: input.cliVersion,
    kitId: input.kitId,
    dbChoice: input.dbChoice,
    packageManager: input.packageManager,
    durationMs: input.durationMs,
    ...(input.anonymousId !== undefined
      ? { anonymousId: input.anonymousId }
      : {})
  };

  if (event === 'install_success') {
    return {
      event,
      ...base
    };
  }

  requireOneOf('failStage', input.failStage, FAIL_STAGES);
  /** @type {FailPayload} */
  const fail = {
    event,
    ...base,
    failStage: input.failStage
  };
  if (input.errorCode !== undefined && isErrorCode(input.errorCode)) {
    fail.errorCode = input.errorCode;
  }
  return fail;
}

/**
 * The closed set of keys that may appear on a payload, by event. Exported for
 * the firewall test to make the guarantee explicit.
 * @param {TelemetryEvent} event
 * @returns {ReadonlyArray<keyof SuccessPayload | keyof FailPayload>}
 */
export function allowedFields(event) {
  return event === 'install_fail'
    ? FAIL_FIELDS
    : SUCCESS_FIELDS;
}

/** @type {ReadonlyArray<keyof SuccessPayload>} */
const SUCCESS_FIELDS = Object.freeze([
  'event', 'cliVersion', 'anonymousId', 'kitId', 'dbChoice',
  'packageManager', 'durationMs'
]);

/** @type {ReadonlyArray<keyof FailPayload>} */
const FAIL_FIELDS = Object.freeze([
  ...SUCCESS_FIELDS, 'failStage', 'errorCode'
]);

export { SchemaError };
