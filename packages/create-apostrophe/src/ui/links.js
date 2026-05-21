// Centralized URL registry for every link the flow renders to the user.
// Real URLs land later; these stubs let copy-and-link work end-to-end
// today and stay editable in exactly one place. `link()` and
// `kitGuide()` stamp `utm_source` so we can attribute the install funnel
// without each call site remembering to do it.

const LINKS = Object.freeze({
  telemetryPolicy: '[link to telemetry policy]',
  docs: 'https://docs.apostrophecms.com',
  discord: 'https://discord.gg/apostrophe',
  demoSite: 'https://demo.apostrophecms.com',
  dbGuide: 'https://apostrophecms.com/guides/choosing-a-db'
});

/** Per-kit "get oriented" guides. `*-demo` and `*-demo-data` share a guide. */
const KIT_GUIDES = Object.freeze({
  'apostrophe-astro-essentials': 'https://apostrophecms.com/guides/astro-essentials-overview',
  'apostrophe-astro-demo': 'https://apostrophecms.com/guides/astro-demo-overview',
  'apostrophe-astro-demo-data': 'https://apostrophecms.com/guides/astro-demo-overview',
  'apostrophe-essentials': 'https://apostrophecms.com/guides/apostrophe-standalone-essentials-overview',
  'apostrophe-demo': 'https://apostrophecms.com/guides/apostrophe-demo-overview',
  'apostrophe-demo-data': 'https://apostrophecms.com/guides/apostrophe-demo-overview'
});

/** @typedef {keyof typeof LINKS} LinkName */

/**
 * @param {string} url
 * @param {string} utmSource
 * @returns {string}
 */
function stampUtm(url, utmSource) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}utm_source=${utmSource}`;
}

/**
 * @param {LinkName} name
 * @param {{ utmSource?: string, stamp?: boolean }} [opts]
 *   `stamp: false` returns the bare URL (e.g. for Discord invite links).
 * @returns {string}
 */
export function link(name, { utmSource = 'cli', stamp = true } = {}) {
  const base = LINKS[name];
  if (!base) {
    throw new TypeError(`Unknown link: ${JSON.stringify(name)}`);
  }
  return stamp ? stampUtm(base, utmSource) : base;
}

/**
 * @param {string} kitId
 * @param {{ utmSource?: string }} [opts]
 * @returns {string}
 */
export function kitGuide(kitId, { utmSource = 'cli' } = {}) {
  const base = KIT_GUIDES[kitId];
  if (!base) {
    throw new TypeError(`No guide registered for kitId: ${JSON.stringify(kitId)}`);
  }
  return stampUtm(base, utmSource);
}
