/** @typedef {import('../index.js').FailStage} FailStage */

export class StageError extends Error {
  /**
   * @param {FailStage} stage
   * @param {{ code?: string, cause?: Error, details?: string }} [info]
   *   `details` is raw output from a child process, for the user's eyes only.
   *   It is the opposite of `errorCode`: unbounded, unvetted text that must
   *   reach the terminal and must never reach telemetry. The orchestrator
   *   logs it and deliberately keeps it off the result object, which is
   *   spread wholesale into the telemetry payload.
   */
  constructor(stage, {
    code, cause, details
  } = {}) {
    super(`stage "${stage}" failed${code ? ` (${code})` : ''}`);
    this.name = 'StageError';
    /** @type {FailStage} */
    this.stage = stage;
    /** @type {string|undefined} symbolic, never raw error text */
    this.errorCode = code;
    if (cause) {
      this.cause = cause;
    }
    if (details) {
      /** @type {string|undefined} console-only; never telemetry */
      this.details = details;
    }
  }
}

// Thrown when the active package manager is not supported. Not a StageError:
// a preflight precondition.
export class UnsupportedPackageManagerError extends Error {
  /**
   * @param {string} packageManager Detected manager (e.g. 'pnpm', 'yarn').
   * @param {readonly string[]} supported Supported managers (from pm.js).
   */
  constructor(packageManager, supported = []) {
    super(`Unsupported package manager: ${packageManager}`);
    this.name = 'UnsupportedPackageManagerError';
    this.packageManager = packageManager;
    this.supported = supported;
    // Allowlisted preflight code (telemetry: install_fail, failStage:null).
    this.errorCode = 'unsupported_pm';
  }
}
