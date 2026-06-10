/** @typedef {import('../index.js').FailStage} FailStage */

export class StageError extends Error {
  /**
   * @param {FailStage} stage
   * @param {{ code?: string, cause?: Error }} [info]
   */
  constructor(stage, { code, cause } = {}) {
    super(`stage "${stage}" failed${code ? ` (${code})` : ''}`);
    this.name = 'StageError';
    /** @type {FailStage} */
    this.stage = stage;
    /** @type {string|undefined} symbolic, never raw error text */
    this.errorCode = code;
    if (cause) {
      this.cause = cause;
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
