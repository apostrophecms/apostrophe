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
export function aposFetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
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
export function aposPageFetch(req: Request): Promise<object>;
