// Public API of create-apostrophe. This is the only module consumers may
// import; everything under core/, ui/ and telemetry/ is private.
//
// Re-exports:
//   - createProject  (headless install orchestration)
//   - createTelemetry (consent-aware emitter constructor)
//
// The typedefs below are the shared contract between the UI, core and
// telemetry layers.

/**
 * Starter-kit identifier. `astro` kits pair an Astro frontend with an
 * Apostrophe backend; the others are full-stack standalone. `demo` kits
 * scaffold a working example; `demo-data` additionally seeds a database
 * dump and sample images. Multisite/pro kits are not offered here.
 * @typedef {(
 *   'apostrophe-astro-essentials' |
 *   'apostrophe-astro-demo' |
 *   'apostrophe-astro-demo-data' |
 *   'apostrophe-essentials' |
 *   'apostrophe-demo' |
 *   'apostrophe-demo-data'
 * )} KitId
 */

/**
 * Database selection. Used for both the createProject input and the
 * telemetry dbChoice value.
 * @typedef {('sqlite' | 'mongodb' | 'postgres')} DbChoice
 */

/**
 * Package manager, detected from the environment (never self-reported).
 * `'unknown'` when it cannot be determined.
 * @typedef {('npm' | 'pnpm' | 'yarn' | 'unknown')} PackageManager
 */

/**
 * The stage a failed install is attributed to. `null` means the failure
 * happened in preflight (Node version / package manager), before any stage
 * ran — every step is skipped. Otherwise exactly one stage per failure.
 * @typedef {(
 *   'clone' | 'dependency_install' | 'db_connect' | 'scaffold' | 'admin'
 *   | 'unknown' | null
 * )} FailStage
 */

/**
 * Terminal telemetry event. Exactly one is emitted per attempt.
 * @typedef {('install_success' | 'install_fail')} TelemetryEvent
 */

/**
 * Admin account created during install. `username` is the value the user
 * will log in with; it may be email-shaped (a single field, no separate
 * email). Never reaches telemetry.
 * @typedef {object} AdminAccount
 * @property {string} username Username or email.
 * @property {string} password Plaintext; passed over stdin, never logged.
 */

/**
 * Fully resolved, already-validated inputs. createProject does not prompt.
 * @typedef {object} CreateProjectOptions
 * @property {string}          shortName        Project/directory name.
 * @property {string}          cwd              Authoritative working
 *                                              directory the install runs
 *                                              from. The caller (bin / UI)
 *                                              captures it once and threads
 *                                              it in; steps must not call
 *                                              process.cwd() on their own.
 * @property {KitId}           kitId            Starter kit.
 * @property {DbChoice}        dbChoice         Database selection.
 * @property {string}          [dbUri]          Connection string for
 *                                              mongodb/postgres. Never sent to
 *                                              telemetry. Ignored for sqlite.
 * @property {AdminAccount}    admin            Admin account to create.
 * @property {PackageManager}  [packageManager] Override; otherwise detected.
 * @property {boolean}         nonInteractive   CI mode: no prompts downstream.
 * @property {number}          confirmedAt      Plan-confirmation timestamp
 *                                              (epoch ms), set by the caller.
 *                                              Source of durationMs.
 */

/**
 * Structured outcome. createProject never throws for an expected install
 * failure and never calls process.exit: it resolves with `ok: false` and a
 * `failStage`. An unexpected throw is the caller's to convert into a fail
 * result.
 * @typedef {object} CreateProjectResult
 * @property {boolean}         ok             Whether the project was created.
 * @property {KitId}           kitId
 * @property {DbChoice}        dbChoice       Echo of the input.
 * @property {PackageManager}  packageManager Resolved value.
 * @property {number}          durationMs     `Date.now() - options.confirmedAt`.
 * @property {FailStage}       [failStage]    Present iff `ok === false`;
 *                                            `null` for a preflight failure.
 * @property {string}          [errorCode]    Present only for known,
 *                                            allowlisted error codes.
 */

/**
 * Partial payload createProject hands to {@link TelemetryHook.event}. The
 * telemetry layer adds `event` (discriminator), `cliVersion`, and
 * `anonymousId` (D15) before sending; the schema validators reject any
 * field outside this allowlist. `failStage`/`errorCode` are present iff
 * the result was a failure. `errorCode` is typed `string` here — the
 * telemetry-side allowlist drops unknown codes (D7), so the contract stays
 * permissive while the wire stays strict.
 * @typedef {object} TelemetryEventPayload
 * @property {KitId}           kitId
 * @property {DbChoice}        dbChoice
 * @property {PackageManager}  packageManager
 * @property {number}          durationMs
 * @property {FailStage}       [failStage]
 * @property {string}          [errorCode]
 */

/**
 * Telemetry hook injected into createProject. Called exactly once, at the
 * single terminal point. Fire-and-forget: `event` must not throw or delay
 * the caller.
 * @typedef {object} TelemetryHook
 * @property {(name: TelemetryEvent, payload: TelemetryEventPayload) => void} event
 */

/**
 * Hook returned by {@link createTelemetry}. Extends {@link TelemetryHook}
 * with `flush()` so the bin can await any in-flight emission at process
 * exit. `event()` is fire-and-forget; `flush()` is the bounded wait.
 * @typedef {TelemetryHook & { flush(): Promise<void> }} ManagedTelemetryHook
 */

/**
 * Handle returned by `Logger.task` to settle a unit of work.
 * @typedef {object} TaskHandle
 * @property {(msg?: string) => void} succeed
 * @property {(msg?: string) => void} fail
 */

/**
 * Headless progress sink injected into createProject, keeping core
 * UI-agnostic. The UI layer adapts its spinners to this; tests pass a
 * recording stub. `task` opens a unit of work and returns a handle.
 * @typedef {object} Logger
 * @property {(msg: string) => void}         info
 * @property {(msg: string) => void}         warn
 * @property {(msg: string) => void}         error
 * @property {(msg: string) => void}         [muted]  Optional dimmed-aside
 *   channel for inline notes the user can ignore (e.g. recovery hints).
 *   Optional so the contract stays backwards-compatible with existing
 *   logger stubs.
 * @property {(label: string) => TaskHandle} task
 */

/**
 * @typedef {object} CreateProjectDeps
 * @property {TelemetryHook} telemetry
 * @property {Logger}        logger
 */

/**
 * Headless project orchestration: no prompts, no process.exit, no UI imports.
 * @typedef {(
 *   options: CreateProjectOptions,
 *   deps: CreateProjectDeps
 * ) => Promise<CreateProjectResult>} CreateProject
 */

/**
 * Construction-time config for the telemetry client. The caller reads
 * consent + anonymousId from the local store and passes them in;
 * createTelemetry performs no store I/O. `consent: false` makes the
 * returned hook a no-op (no payload built, no transport invoked).
 * @typedef {object} TelemetryConfig
 * @property {boolean} consent      Opt-in result.
 * @property {string}  [endpoint]   Analytics endpoint.
 * @property {string}  [writeKey]   Analytics write key.
 * @property {string}  cliVersion   Semver of the invoking package.
 * @property {string}  [anonymousId] Stable anonymous identifier (UUID v4,
 *                                  D15). Generated by consent.js on first
 *                                  opt-in, reused thereafter. Absent until
 *                                  the user has ever opted in.
 * @property {boolean} [verbose]    Surface transport errors (otherwise silent).
 */

/**
 * @typedef {(config: TelemetryConfig) => ManagedTelemetryHook} CreateTelemetry
 */

export { createProject } from './core/create-project.js';
export { createTelemetry } from './telemetry/index.js';
