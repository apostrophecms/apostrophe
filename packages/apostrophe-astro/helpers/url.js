import config from 'virtual:apostrophe-config';

/**
 * Get the Apostrophe backend base URL, including the prefix when
 * configured.
 *
 * Returns `config.aposHost + config.aposPrefix` — the full base URL
 * for reaching the Apostrophe backend (e.g.
 * `http://localhost:3000/my-repo`).  Environment variable overrides
 * (`APOS_HOST`, `APOS_PREFIX`) are resolved once at config time in
 * the integration's `astro:config:setup` hook and stored in the
 * virtual config module — this function does no env lookups.
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
 * import { getAposHost } from '@apostrophecms/apostrophe-astro/helpers';
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
 * import { isStaticBuild } from '@apostrophecms/apostrophe-astro/helpers';
 * ---
 * <html data-static={isStaticBuild()}>
 * ```
 */
export function isStaticBuild() {
  return Boolean(config.staticBuild);
}

// Mode-aware URL building utilities for Apostrophe piece index
// pages. Detects whether the backend uses static (path-based) URLs
// via `aposData.staticUrls` (set by `@apostrophecms/url` when its
// `static` option is `true`) and builds correct pagination & filter
// URLs:
//
// Static URLs (`@apostrophecms/url` option `static: true`):
//   /articles/page/2
//   /articles/categories/insights/page/2
//
// Dynamic URLs (default):
//   /articles?page=2
//   /articles?categories=insights&page=2

/**
 * Get the effective base URL for the current filter context.
 *
 * If a filter choice is active, returns its `_url` (which already
 * includes the filter segment in the correct format). Otherwise
 * returns `page._url` — the plain index page URL.
 *
 * @param {object} aposData - The `aposData` object from `Astro.props`.
 * @param {object} aposData.page - The page document (must have `_url`).
 * @param {Array}  [aposData.filters] - Filter definitions with choices.
 * @returns {string} The base URL representing page 1 of the current
 *   filter context.
 */
export function getFilterBaseUrl(aposData) {
  const { page, filters = [] } = aposData;

  for (const filter of filters) {
    const activeChoice = filter.choices?.find((c) => c.active);
    if (activeChoice?._url) {
      return activeChoice._url;
    }
  }

  return page?._url || '/';
}

/**
 * Build a pagination URL for a piece index page.
 *
 * Works in both static (path-based) and dynamic (query-string) modes.
 * The mode is determined by `aposData.staticUrls`, which is set by the
 * backend's `@apostrophecms/url` module when its `static` option is
 * enabled. This ensures consistent URLs regardless of whether the
 * Astro frontend runs in SSR or static build mode.
 *
 * The function determines the correct base URL by looking at the
 * active filter choice (if any) and appends the page number in the
 * appropriate format.
 *
 * Page 1 always returns the base URL without a page suffix.
 *
 * @param {object} aposData - The `aposData` object from `Astro.props`.
 *   Must contain `page` (with `_url`) and optionally `filters`.
 *   `aposData.staticUrls` controls path-based vs query-string URLs.
 * @param {number} pageNum - The target page number (1-based).
 * @returns {string} The URL for the given page.
 *
 * @example
 * ```astro
 * ---
 * import { buildPageUrl } from '@apostrophecms/apostrophe-astro/helpers';
 * const { aposData } = Astro.props;
 * ---
 * <a href={buildPageUrl(aposData, 2)}>Page 2</a>
 * ```
 */
export function buildPageUrl(aposData, pageNum) {
  const baseUrl = getFilterBaseUrl(aposData);

  if (pageNum <= 1) {
    return baseUrl;
  }

  if (aposData.staticUrls) {
    return `${baseUrl}/page/${pageNum}`;
  }

  // Dynamic mode — append as query parameter, preserving any
  // existing query string (e.g. ?categories=insights).
  const url = new URL(baseUrl, 'http://localhost');
  url.searchParams.set('page', String(pageNum));
  return `${url.pathname}${url.search}`;
}

/**
 * Add, update or remove a named query parameter and return a new URL.
 *
 * If `value` is `undefined`, `null` or empty string the parameter is
 * removed from the query string.  Internal Apostrophe parameters
 * (`aposRefresh`, `aposMode`, `aposEdit`) are always stripped.
 *
 * Typically `Astro.url` is passed as the first argument.
 *
 * @param {URL|string} url - The current URL.
 * @param {string} name - The query parameter name.
 * @param {string|null|undefined} value - The value to set, or
 *   `null`/`undefined`/`''` to remove.
 * @returns {URL} A new URL with the parameter applied.
 *
 * @example
 * ```astro
 * ---
 * import { aposSetQueryParameter } from '@apostrophecms/apostrophe-astro/helpers';
 * const next = aposSetQueryParameter(Astro.url, 'page', '2');
 * ---
 * <a href={next.pathname + next.search}>Page 2</a>
 * ```
 */
export function aposSetQueryParameter(url, name, value) {
  const newUrl = new URL(url);
  // Internal query parameters not suitable for public facing URLs
  newUrl.searchParams.delete('aposRefresh');
  newUrl.searchParams.delete('aposMode');
  newUrl.searchParams.delete('aposEdit');
  if ((value == null) || (value === '')) {
    newUrl.searchParams.delete(name);
  } else {
    newUrl.searchParams.set(name, value);
  }
  return newUrl;
}
