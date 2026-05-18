// Public API of create-apostrophe. This is the only module consumers may
// import; everything under core/, ui/ and telemetry/ is private.
//
// Re-exports are added as implementations land:
//   - createProject
//   - createTelemetry
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
 * The stage a failed install is attributed to. Exactly one per failure.
 * @typedef {(
 *   'clone' | 'dependency_install' | 'db_connect' | 'scaffold' | 'unknown'
 * )} FailStage
 */

/**
 * Terminal telemetry event. Exactly one is emitted per attempt.
 * @typedef {('install_success' | 'install_fail')} TelemetryEvent
 */

/**
 * Admin account created during install. `login` is a username or email
 * (single field). Never reaches telemetry.
 * @typedef {object} AdminAccount
 * @property {string} login    Username or email.
 * @property {string} password Plaintext; passed over stdin, never logged.
 */

/**
 * Fully resolved, already-validated inputs. createProject does not prompt.
 * @typedef {object} CreateProjectOptions
 * @property {string}          shortName        Project/directory name.
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
 * @property {FailStage}       [failStage]    Present iff `ok === false`.
 * @property {string}          [errorCode]    Present only for known,
 *                                            allowlisted error codes.
 */

/**
 * Telemetry hook injected into createProject. Called exactly once, at the
 * single terminal point. Fire-and-forget: `event` must not throw or delay
 * the caller.
 * @typedef {object} TelemetryHook
 * @property {(name: TelemetryEvent, payload: object) => void} event
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
 * Construction-time config for the telemetry client. The caller reads consent
 * from the local store and passes it in; createTelemetry performs no store
 * I/O. `consent: false` makes the returned hook a no-op.
 * @typedef {object} TelemetryConfig
 * @property {boolean} consent    Opt-in result.
 * @property {string}  [endpoint] Analytics endpoint.
 * @property {string}  [writeKey] Analytics write key.
 * @property {string}  cliVersion Semver of the invoking package.
 * @property {boolean} [verbose]  Surface transport errors (otherwise silent).
 */

/**
 * @typedef {(config: TelemetryConfig) => TelemetryHook} CreateTelemetry
 */

export {};
