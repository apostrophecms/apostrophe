// This integration runs inside Astro, not inside Apostrophe: its output belongs
// to the Astro build and dev server and never travels through the Apostrophe
// log pipeline. Everything it prints carries the same prefix, colored only when
// the terminal accepts color (NO_COLOR and friends are honored in format.js).

import { dim, red, yellow } from './format.js';

const prefix = '[apostrophe-astro]';

export function logInfo(...args) {
  console.log(dim(prefix), ...args);
}

export function logWarn(...args) {
  console.warn(yellow(prefix), ...args);
}

const warned = new Set();

// Warn about a situation that can repeat on every item of a page, such as a
// field of a piece in a list, without printing it twenty times. `key` names
// the situation, not the occurrence: `apostrophe.article.title`, not the _id
// of one article. An .astro file has no module scope of its own, which is the
// other reason this lives here.
export function logWarnOnce(key, ...args) {
  if (warned.has(key)) {
    return;
  }
  warned.add(key);
  logWarn(...args);
}

export function logError(...args) {
  console.error(red(prefix), ...args);
}
