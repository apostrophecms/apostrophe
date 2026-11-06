// Which Node.js versions each kit can run on.
//
// The bin/ guard enforces the floor for the installer itself (22). Kits can
// need more: Astro's own `engines.node` floor moves with each Astro release
// (7.4.4 wants >=22.23.4), and the Demo kit doesn't pin Astro, so tracking
// 22.x minors here would go stale. Astro kits require the next major instead,
// matching the published guidance to use Node.js 24.

import { getKit } from './kits.js';
import { UnsupportedNodeVersionError } from './errors.js';

/** Minimum Node.js major the installer itself runs on (mirrors bin/). */
export const INSTALLER_NODE_MAJOR = 22;

/**
 * Minimum Node.js major per kit frontend. `standalone` is a kit with
 * `frontend: null`.
 */
export const KIT_NODE_MAJOR = Object.freeze({
  astro: 24,
  standalone: INSTALLER_NODE_MAJOR
});

/**
 * @param {string} kitId
 * @returns {number} the minimum Node.js major `kitId` runs on.
 */
export function requiredNodeMajor(kitId) {
  return KIT_NODE_MAJOR[getKit(kitId).frontend ?? 'standalone'];
}

/**
 * @param {string} version e.g. `'22.23.1'` (a leading `v` is tolerated).
 * @returns {number} the major, or NaN if unparseable.
 */
export function parseNodeMajor(version) {
  return parseInt(String(version ?? '').replace(/^v/, '').split('.')[0], 10);
}

/**
 * Non-throwing form of {@link assertNodeSupported}. An unparseable version
 * passes: we can't tell, and refusing would block every install.
 * @param {string} kitId
 * @param {string} [version] Defaults to `process.versions.node`.
 * @returns {boolean}
 */
export function isNodeSupported(kitId, version = process.versions.node) {
  const major = parseNodeMajor(version);
  return !Number.isFinite(major) || major >= requiredNodeMajor(kitId);
}

/**
 * Reject a Node.js version the kit can't run on, before any work is done.
 * @param {string} kitId
 * @param {string} [version] Defaults to `process.versions.node`.
 * @throws {UnsupportedNodeVersionError}
 */
export function assertNodeSupported(kitId, version = process.versions.node) {
  if (!isNodeSupported(kitId, version)) {
    throw new UnsupportedNodeVersionError(version, requiredNodeMajor(kitId));
  }
}
