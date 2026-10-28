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
export function aposFetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
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
export function createAposFetch(req: Request): (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
