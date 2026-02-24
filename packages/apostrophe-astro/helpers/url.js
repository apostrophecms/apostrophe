import config from 'virtual:apostrophe-config';

/**
 * Get the Apostrophe backend host URL.
 *
 * Reads from the `APOS_HOST` environment variable first, then
 * falls back to the `aposHost` value configured in the Astro
 * integration options.
 *
 * @returns {string} The backend host URL (e.g. `http://localhost:3000`).
 *
 * @example
 * ```astro
 * ---
 * import { getAposHost } from '@apostrophecms/apostrophe-astro/helpers';
 * const host = getAposHost();
 * const res = await fetch(`${host}/api/v1/...`);
 * ---
 * ```
 */
export function getAposHost() {
  return process.env.APOS_HOST || config.aposHost;
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
