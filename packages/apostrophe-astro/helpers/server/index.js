/**
 * Server-only public helpers for @apostrophecms/apostrophe-astro.
 *
 * Use these in Astro frontmatter, server endpoints, prerendering routes,
 * and any other server-side code. Do not import this module from
 * client-side scripts — it depends on generated integration config and
 * Node.js internals unavailable in browsers.
 *
 * @module @apostrophecms/apostrophe-astro/helpers/server
 */

export { aposFetch } from './fetch.js';
export { getAposHost, isStaticBuild } from './url.js';
export { getAllStaticPaths, getAllUrlMetadata, getLocales } from './static.js';
