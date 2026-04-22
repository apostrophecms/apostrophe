import config from '../lib/getConfig.js';
import { getAposHost } from './server.js';

/**
 * A transparent proxy around the native `fetch` API for **server-side
 * Astro code only** (`.astro` frontmatter, server endpoints, etc.).
 *
 * **Do NOT use in client-side code** — it depends on
 * server-side runtime config and exposes the internal backend host.
 * For browser requests use plain `fetch` with relative URLs
 * (e.g. `/api/v1/...`).
 *
 * What it does on top of native `fetch`:
 * - Prepends the Apostrophe backend host (`getAposHost()`) to relative
 *   URLs (paths starting with `/`).
 * - Injects the `x-apos-static-base-url: 1` header during static builds
 *   so the backend returns path-only URLs in its responses.
 *
 * Accepts the same arguments as `fetch(input, init?)` and returns a
 * standard `Response`. All `init` options (method, body, headers, signal,
 * etc.) are preserved and merged.
 *
 * @param {string|URL|Request} input - URL or Request object. Relative
 *   paths (starting with `/`) are resolved against `getAposHost()`.
 * @param {RequestInit} [init] - Optional fetch init options.
 * @returns {Promise<Response>}
 *
 * @example
 * ```astro
 * ---
 * import { aposFetch } from '@apostrophecms/apostrophe-astro/helpers/fetch.js';
 * const response = await aposFetch('/api/v1/article?perPage=5');
 * const data = await response.json();
 * ---
 * ```
 */
export async function aposFetch(input, init) {
  let url = input;

  if (typeof url === 'string' && url.startsWith('/')) {
    url = getAposHost() + url;
  }
  const headers = new Headers(init?.headers);
  if (config.staticBuild) {
    headers.set('x-apos-static-base-url', '1');
  }

  return fetch(url, {
    ...init || {},
    headers
  });
}
