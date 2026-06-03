import sluggo from 'sluggo';
import deburr from 'lodash.deburr';

/**
 * Apostrophe-compatible slugify helper.
 *
 * Converts a string to a URL-safe slug using the same algorithm as
 * the Apostrophe CMS backend, ensuring consistent slugs across
 * frontend and backend.
 *
 * @param {string} text - The string to slugify.
 * @param {import('sluggo').Options & { stripAccents?: boolean }} [options] - Options.
 * @param {boolean} [options.stripAccents] - When `true`, strip accents
 *   from characters (e.g. `é` → `e`). All other options are forwarded
 *   to the underlying `sluggo` library.
 * @returns {string} The slugified string.
 *
 * @example
 * ```js
 * import { slugify } from '@apostrophecms/apostrophe-astro/helpers/universal';
 * slugify('Hello World'); // 'hello-world'
 * slugify('Ça va?', { stripAccents: true }); // 'ca-va'
 * ```
 */
export function slugify(text, options) {
  const { stripAccents, ...opts } = options || {};
  const slug = sluggo(text, opts);
  if (stripAccents) {
    return deburr(slug);
  }
  return slug;
}
