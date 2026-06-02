// Package-manager detection from the npm_config_user_agent the running
// package manager sets when it invokes `npm create` / `npx`.

import { UnsupportedPackageManagerError } from './errors.js';

// Single source of truth for what the installer supports. 'unknown' is run
// as npm but is not a user-facing "supported" choice.
export const SUPPORTED_PACKAGE_MANAGERS = Object.freeze([ 'npm' ]);
const RUNNABLE_AS_NPM = new Set([ ...SUPPORTED_PACKAGE_MANAGERS, 'unknown' ]);

/**
 * @param {string} [userAgent] Defaults to `process.env.npm_config_user_agent`.
 * @returns {('npm'|'pnpm'|'yarn'|'unknown')}
 */
export function detectPackageManager(userAgent = process.env.npm_config_user_agent) {
  if (!userAgent) {
    return 'unknown';
  }
  const name = String(userAgent).split('/')[0].trim().toLowerCase();
  return (name === 'npm' || name === 'pnpm' || name === 'yarn')
    ? name
    : 'unknown';
}

/**
 * Reject an unsupported manager before any work is done. npm / unknown pass.
 * @param {string} pm
 * @returns {string}
 * @throws {UnsupportedPackageManagerError} for pnpm/yarn/etc.
 */
export function assertSupportedPackageManager(pm) {
  if (!RUNNABLE_AS_NPM.has(pm)) {
    throw new UnsupportedPackageManagerError(pm, SUPPORTED_PACKAGE_MANAGERS);
  }
  return pm;
}
