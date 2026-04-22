import config from '../lib/getConfig.js';

/**
 * Get the Apostrophe backend base URL, including the prefix when
 * configured.
 *
 * Returns `config.aposHost + config.aposPrefix` — the full base URL
 * for reaching the Apostrophe backend (e.g.
 * `http://localhost:3000/my-repo`).  Environment variable overrides
 * (`APOS_HOST`, `APOS_PREFIX`) are resolved once at config time in
 * the integration's `astro:config:setup` hook.
 *
 * Prefer `aposFetch` for API calls — use `getAposHost()` only when
 * you need the raw URL string (e.g. for building non-fetch URLs).
 *
 * WARNING: not to be confused with "Public Host" - this is meant to
 * be used only in Astro server-side code. Use relative URLs for
 * client-side requests `/api/v1/...`.
 *
 * @returns {string} The backend base URL (e.g. `http://localhost:3000`
 *   or `http://localhost:3000/my-repo`).
 *
 * @example
 * ```astro
 * ---
 * import { getAposHost } from '@apostrophecms/apostrophe-astro/helpers/server.js';
 * const host = getAposHost();
 * // e.g. 'http://localhost:3000' or 'http://localhost:3000/my-repo'
 * ---
 * ```
 */
export function getAposHost() {
  return config.aposHost + (config.aposPrefix || '');
}

/**
 * Check whether the current build is a static build.
 *
 * Returns `true` when the Astro integration is configured for
 * static output (e.g. `output: 'static'` with `APOS_BUILD=static`).
 *
 * @returns {boolean}
 *
 * @example
 * ```astro
 * ---
 * import { isStaticBuild } from '@apostrophecms/apostrophe-astro/helpers/server.js';
 * ---
 * <html data-static={isStaticBuild()}>
 * ```
 */
export function isStaticBuild() {
  return Boolean(config.staticBuild);
}
