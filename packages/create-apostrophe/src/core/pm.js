// Package-manager detection from the npm_config_user_agent the running
// package manager sets when it invokes `npm create` / `npx`.

import { UnsupportedPackageManagerError } from './errors.js';

// Single source of truth for what the installer supports. The install itself
// always runs `npm install` (npm ships with Node), so a few other launchers
// are let through and run as npm: pnpm (the starter kits are npm projects, so
// the UI tells the user the project uses npm) and 'unknown' (bun, no user
// agent, …), which is not a user-facing "supported" choice. yarn is still
// rejected up front.
export const SUPPORTED_PACKAGE_MANAGERS = Object.freeze([ 'npm' ]);
const RUNNABLE_AS_NPM = new Set([ ...SUPPORTED_PACKAGE_MANAGERS, 'pnpm', 'unknown' ]);

/**
 * True for a manager the user knowingly launched us with that we let through
 * but install with npm instead, so the UI should say so.
 * @param {string} pm
 * @returns {boolean}
 */
export function installsWithNpmInstead(pm) {
  return RUNNABLE_AS_NPM.has(pm) &&
    !SUPPORTED_PACKAGE_MANAGERS.includes(pm) &&
    pm !== 'unknown';
}

/**
 * Non-throwing form of {@link assertSupportedPackageManager}.
 * @param {string} pm
 * @returns {boolean}
 */
export function isRunnablePackageManager(pm) {
  return RUNNABLE_AS_NPM.has(pm);
}

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
 * Reject an unsupported manager before any work is done. npm / pnpm /
 * unknown pass.
 * @param {string} pm
 * @returns {string}
 * @throws {UnsupportedPackageManagerError} for yarn/etc.
 */
export function assertSupportedPackageManager(pm) {
  if (!isRunnablePackageManager(pm)) {
    throw new UnsupportedPackageManagerError(pm, SUPPORTED_PACKAGE_MANAGERS);
  }
  return pm;
}
