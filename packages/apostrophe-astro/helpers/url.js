// Mode-aware URL building utilities for Apostrophe piece index
// pages. 
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
 * This tool is not static URL aware.
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
