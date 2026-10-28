import config from 'apostrophe-astro-config/config';
import aposRequest, { isAstroPrerenderedRequest } from '../../lib/aposRequest.js';
import aposResponse from '../../lib/aposResponse.js';
import { getAposHost, isStaticBuild } from './url.js';

// Headers that describe the incoming page request itself, not a request
// made on its behalf, so they are not forwarded by `createAposFetch`.
const pageOnlyHeaders = [
  'accept',
  'accept-encoding',
  'content-length',
  'content-type',
  'transfer-encoding'
];

/**
 * A transparent proxy around the native `fetch` API for **server-side
 * Astro code only** (`.astro` frontmatter, server endpoints, etc.).
 *
 * It always talks to the one configured Apostrophe backend and sends no
 * cookies or `host` of the current request, so it does not reach the
 * right site in a multisite project and is never logged in. In
 * components, widgets and endpoints prefer `Astro.locals.aposFetch`,
 * which is scoped to the current request (see `createAposFetch`). Use
 * this one where there is no request, e.g. in `getStaticPaths`.
 *
 * **Do NOT use in client-side code** — it depends on
 * `apostrophe-astro-config/config` and exposes the internal backend host.
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
 * import { aposFetch } from '@apostrophecms/apostrophe-astro/helpers/server';
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


/**
 * Create a `fetch`-like function scoped to an incoming Astro request,
 * for **server-side Astro code only**. The integration's middleware
 * already provides one for every request as `Astro.locals.aposFetch`,
 * so most projects never call this directly.
 *
 * The request goes to Apostrophe exactly as the page itself does: it
 * carries the current request's `host` (which selects the site in a
 * multisite project), cookies (so the logged-in user's permissions
 * apply) and other headers, plus the external front key. Only the path
 * and query string of `input` are used. A path starting with `/` is
 * prefixed with `aposPrefix`; other relative URLs resolve against the
 * current page URL.
 *
 * During static builds there are no user headers to forward, and the
 * returned function is `aposFetch`.
 *
 * @param {Request} req - The incoming request (`Astro.request`).
 * @returns {(input: string|URL|Request, init?: RequestInit) => Promise<Response>}
 *
 * @example
 * ```astro
 * ---
 * const response = await Astro.locals.aposFetch('/api/v1/article?perPage=5');
 * const data = await response.json();
 * ---
 * ```
 */
export function createAposFetch(req) {
  if (isAstroPrerenderedRequest(req) || isStaticBuild()) {
    return aposFetch;
  }
  return async function scopedAposFetch(input, init) {
    let url;
    if (typeof input === 'string' && input.startsWith('/')) {
      url = new URL((config.aposPrefix || '') + input, req.url);
    } else {
      url = new URL(input instanceof Request ? input.url : input, req.url);
    }
    const headers = new Headers(req.headers);
    for (const name of pageOnlyHeaders) {
      headers.delete(name);
    }
    const overrides = [
      input instanceof Request ? input.headers : null,
      new Headers(init?.headers)
    ];
    for (const override of overrides) {
      for (const [ name, value ] of override || []) {
        headers.set(name, value);
      }
    }
    const request = new Request(url, {
      method: input instanceof Request ? input.method : undefined,
      body: input instanceof Request ? input.body : undefined,
      ...init || {},
      headers,
      duplex: 'half'
    });
    return aposResponse(aposRequest(request));
  };
}
