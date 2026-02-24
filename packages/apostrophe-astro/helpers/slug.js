import sluggo from "sluggo";
import deburr from "lodash.deburr";

/**
 * Apostrophe compatible slugify helper.
 * 
 * @param {string} text 
 * @param {import('sluggo').Options} options
 * @param {boolean} options.stripAccents - Whether to strip accents from characters.
 * @returns 
 */
export function slugify(text, options) {
  const { stripAccents, ...opts } = options || {};
  const slug = sluggo(text, opts);
  if (stripAccents) {
    return deburr(slug);
  }
  return slug;
}
