/**
 * @deprecated Import from the scoped sub-paths instead:
 *
 * ```js
 * // Server-side helpers (Astro frontmatter, endpoints, prerendering)
 * import { aposFetch, getAposHost, isStaticBuild, getAllStaticPaths } from '@apostrophecms/apostrophe-astro/helpers/server';
 *
 * // Universal helpers (server + client)
 * import { slugify, getAttachmentUrl, aposSetQueryParameter } from '@apostrophecms/apostrophe-astro/helpers/universal';
 * ```
 */

export { aposFetch, aposPageFetch, getAposHost, isStaticBuild, getAllStaticPaths, getAllUrlMetadata, getLocales } from './server/index.js';
export { buildPageUrl, getFilterBaseUrl, aposSetQueryParameter, slugify, stylesElements, stylesAttributes, getFocalPoint, getAttachmentUrl, getAttachmentSrcset, getWidth, getHeight } from './universal/index.js';
