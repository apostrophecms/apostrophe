/**
 * Static build helpers — server-only.
 *
 * Re-exports the public static-build functions from `lib/static.js`.
 * Use these in `getStaticPaths()` inside your `[...slug].astro` page
 * to fetch all page paths and props from the Apostrophe backend.
 */

export { getAllStaticPaths, getAllUrlMetadata, getLocales } from '../../lib/static.js';
