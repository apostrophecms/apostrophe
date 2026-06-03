import config from 'apostrophe-astro-config/config';
import { getAposHost } from './url.js';
import aposResponse from '../../lib/aposResponse.js';
import aposRequest from '../../lib/aposRequest.js';

/**
 * A transparent proxy around the native `fetch` API for **server-side
 * Astro code only** (`.astro` frontmatter, server endpoints, etc.).
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
 * Fetch a full Apostrophe page data object for the given Astro request.
 *
 * This is the primary entry point for SSR and static-build page routes.
 * It wraps `aposRequest` and `aposResponse` to forward the incoming
 * request to the Apostrophe backend and return the parsed JSON page data,
 * including automatic handling of trailing-slash redirects.
 *
 * For static builds, use this inside `getStaticPaths` / your page
 * frontmatter to retrieve the `aposData` prop.
 *
 * @param {Request} req - The incoming Astro request (`Astro.request`).
 * @returns {Promise<object>} The Apostrophe page data object. On error,
 *   returns an object with `errorFetchingPage` set to the caught error
 *   and `page.type` set to `'apos-fetch-error'`.
 *
 * @example
 * ```astro
 * ---
 * import { aposPageFetch } from '@apostrophecms/apostrophe-astro/helpers/server';
 * const aposData = await aposPageFetch(Astro.request);
 * ---
 * ```
 */
export async function aposPageFetch(req) {
  let aposData = {};
  try {
    let request = aposRequest(req);
    if (request.method === 'HEAD') {
      request = new Request(request, {
        method: 'GET'
      });
    }
    const response = await aposResponse(request);
    let headers = response.headers;
    aposData = await response.json();

    // Apostrophe's external-front middleware returns redirects as JSON
    // (e.g. { redirect: true, url: '/fr/', status: 302 }). When the
    // redirect only adds or removes a trailing slash we should follow
    // it internally rather than bouncing the browser — otherwise locale
    // home pages like /fr/ cause an infinite redirect loop.
    // Skip the site root "/" — it never needs this treatment.
    //
    // When a prefix is configured, Apostrophe returns redirect URLs
    // without the prefix (it's a routing concern, not stored in page
    // data).  Strip the prefix from `from` so both sides compare on
    // the same terms, then re-add it when constructing the retry URL.
    if (aposData.redirect && aposData.url !== '/') {
      const prefix = config.aposPrefix || '';
      let from = new URL(request.url).pathname.replace(/\/+$/, '');
      if (prefix && from.startsWith(prefix + '/')) {
        from = from.slice(prefix.length);
      } else if (prefix && from === prefix) {
        from = '/';
      }
      const to = (aposData.url || '').replace(/\/+$/, '');
      if (from === to) {
        const retryUrl = prefix + aposData.url;
        const retry = new Request(new URL(retryUrl, request.url), request);
        const retryResponse = await aposResponse(retry);
        headers = retryResponse.headers;
        const retryData = await retryResponse.json();
        // Safety check: if the retry itself redirects to the same
        // URL we just tried, we've hit an infinite redirect loop.
        // Return an error instead of bouncing forever.
        if (retryData.redirect && retryData.url === aposData.url) {
          throw new Error(
            `Infinite redirect detected: ${aposData.url} redirects back to itself`
          );
        }
        aposData = retryData;
      }
    }

    aposData.aposResponseHeaders = headers;
    if (aposData.template === '@apostrophecms/page:notFound') {
      aposData.notFound = true;
    }
  } catch (e) {
    console.error('error:', e);
    aposData.errorFetchingPage = e;
    aposData.page = {
      type: 'apos-fetch-error'
    };
  }
  return aposData;
}
