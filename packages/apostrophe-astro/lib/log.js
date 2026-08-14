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

export function logError(...args) {
  console.error(red(prefix), ...args);
}
