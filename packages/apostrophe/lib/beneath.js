// Small, dependency-free replacements for the few third-party browser
// dependencies Apostrophe's admin UI actually needs — a handful of lodash
// methods and an id generator. Import from here instead of from `lodash` or
// `@paralleldrive/cuid2` in code that gets bundled for the browser.
//
// Why this exists: `lodash` is CommonJS and not tree-shakeable, so a single
// `import { isEqual } from 'lodash'` pulls the whole library (~72KB) into the
// logged-in admin bundle for the sake of one function — and it was landing
// there more than once. `@paralleldrive/cuid2` likewise drags in `@noble/hashes`
// (and, under some dependency layouts, `bignumber.js`) purely to mint
// client-side ids. These focused replacements keep both out of the browser
// bundle entirely (~195KB minified saved) regardless of bundler (works for both
// Vite and webpack, since it is a plain module import with no build-time
// aliasing).
//
// This is an ES module. Browser code imports it directly; the small amount of
// universal server code that also runs in the browser (e.g.
// schema/lib/newInstance.js) `require()`s it, which Node 22.12+ supports for ES
// modules. It uses only the Web Crypto API (available in browsers and in
// Node via globalThis.crypto), no other Node- or browser-specific APIs.
//
// The lodash replacements' behavior matches lodash for the JSON-shaped data
// Apostrophe deals with (schema values, widget/doc data, slugs); everything
// here is tested in test/beneath.js. This is intentionally NOT a
// general-purpose utility library — only add functions the admin UI needs,
// whose equivalence to what they replace you have verified.

const ID_LENGTH = 24;
const ID_LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const ID_ALPHANUM = 'abcdefghijklmnopqrstuvwxyz0123456789';

// A collision-resistant id generator matching the shape of
// @paralleldrive/cuid2's createId(): 24 lowercase base36 characters starting
// with a letter. Entropy comes from the Web Crypto API, and characters are
// chosen by rejection sampling so the distribution is uniform (no modulo bias
// from mapping 256 byte values onto a 26- or 36-symbol alphabet).
export function createId() {
  let pool = null;
  let poolPos = 0;
  const nextByte = () => {
    if (!pool || poolPos >= pool.length) {
      pool = new Uint8Array(ID_LENGTH * 2);
      globalThis.crypto.getRandomValues(pool);
      poolPos = 0;
    }
    return pool[poolPos++];
  };
  // Uniform index into `alphabet`: discard bytes in the final, partial block of
  // 256 (>= the largest exact multiple of the alphabet size) and redraw, so no
  // symbol is favored.
  const pick = (alphabet) => {
    const size = alphabet.length;
    const limit = 256 - (256 % size);
    let byte;
    do {
      byte = nextByte();
    } while (byte >= limit);
    return alphabet[byte % size];
  };
  let id = pick(ID_LETTERS);
  for (let i = 1; i < ID_LENGTH; i++) {
    id += pick(ID_ALPHANUM);
  }
  return id;
}

// Matches lodash's `isPlainObject`: true only for objects created by the Object
// constructor or with a null prototype.
export function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto === null) {
    return true;
  }
  const Ctor = Object.prototype.hasOwnProperty.call(proto, 'constructor') &&
    proto.constructor;
  return typeof Ctor === 'function' &&
    Ctor instanceof Ctor &&
    Function.prototype.toString.call(Ctor) ===
      Function.prototype.toString.call(Object);
}

// Deep structural equality for the JSON-shaped data the admin UI compares
// (schema field values, render parameters, attachment/style objects):
// primitives, plain objects, arrays, Dates, RegExps, Maps and Sets. NaN equals
// NaN and 0 equals -0, as in lodash.
export function isEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }
  if (
    a === null || b === null ||
    typeof a !== 'object' || typeof b !== 'object'
  ) {
    return false;
  }

  const tag = Object.prototype.toString.call(a);
  if (tag !== Object.prototype.toString.call(b)) {
    return false;
  }

  switch (tag) {
    case '[object Date]':
      return +a === +b || (Number.isNaN(+a) && Number.isNaN(+b));
    case '[object RegExp]':
    case '[object String]':
      return `${a}` === `${b}`;
    case '[object Number]':
      return isEqual(+a, +b);
    case '[object Boolean]':
      return +a === +b;
  }

  const aIsArr = Array.isArray(a);
  if (aIsArr !== Array.isArray(b)) {
    return false;
  }
  if (aIsArr) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  if (tag === '[object Map]' || tag === '[object Set]') {
    if (a.size !== b.size) {
      return false;
    }
    if (tag === '[object Set]') {
      for (const v of a) {
        if (!b.has(v)) {
          return false;
        }
      }
      return true;
    }
    for (const [ k, v ] of a) {
      if (!b.has(k) || !isEqual(v, b.get(k))) {
        return false;
      }
    }
    return true;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !isEqual(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

// Safe nested property access by a dot/bracket path string or an array of keys,
// returning `defaultValue` (or undefined) when the path is missing.
export function get(object, path, defaultValue) {
  if (object == null) {
    return defaultValue;
  }
  const keys = toPath(path);
  let result = object;
  for (const key of keys) {
    if (result == null) {
      return defaultValue;
    }
    result = result[key];
  }
  return result === undefined ? defaultValue : result;
}

function toPath(path) {
  if (Array.isArray(path)) {
    return path;
  }
  if (typeof path === 'number' || typeof path === 'symbol') {
    return [ path ];
  }
  const result = [];
  const str = String(path);
  // Match plain segments, ["quoted"] / ['quoted'] segments, and [index] segments.
  const re = /[^.[\]]+|\[(?:(-?\d+)|["']((?:\\.|[^\\"'])*)["'])\]/g;
  let match;
  while ((match = re.exec(str)) !== null) {
    if (match[2] !== undefined) {
      result.push(match[2].replace(/\\(.)/g, '$1'));
    } else if (match[1] !== undefined) {
      result.push(match[1]);
    } else {
      result.push(match[0]);
    }
  }
  return result;
}

// Recursive deep merge matching lodash semantics for the plain data the admin
// UI merges (context/doc data into a widget instance): own enumerable
// string-keyed properties, arrays merged by index, `undefined` source values
// skipped, target mutated and returned.
export function merge(object, ...sources) {
  for (const source of sources) {
    if (source != null) {
      baseMerge(object, source);
    }
  }
  return object;
}

function baseMerge(target, source) {
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (Array.isArray(sv)) {
      baseMerge(Array.isArray(tv) ? tv : (target[key] = []), sv);
    } else if (isPlainObject(sv)) {
      // Like lodash: merge into the existing target if it is any non-null
      // object (arrays included); only start fresh for primitives/functions.
      const base = (tv !== null && typeof tv === 'object')
        ? tv
        : (target[key] = {});
      baseMerge(base, sv);
    } else if (sv !== undefined) {
      target[key] = sv;
    }
  }
  return target;
}

// Latin-1 Supplement and Latin Extended-A letters with no NFD decomposition,
// mapped exactly as lodash's deburr does.
const DEBURR_SPECIAL = Object.fromEntries([
  [ 'Æ', 'Ae' ],
  [ 'æ', 'ae' ],
  [ 'Ð', 'D' ],
  [ 'ð', 'd' ],
  [ 'Ø', 'O' ],
  [ 'ø', 'o' ],
  [ 'Þ', 'Th' ],
  [ 'þ', 'th' ],
  [ 'ß', 'ss' ],
  [ 'Đ', 'D' ],
  [ 'đ', 'd' ],
  [ 'Ħ', 'H' ],
  [ 'ħ', 'h' ],
  [ 'ı', 'i' ],
  [ 'Ĳ', 'IJ' ],
  [ 'ĳ', 'ij' ],
  [ 'ĸ', 'k' ],
  [ 'Ŀ', 'L' ],
  [ 'ŀ', 'l' ],
  [ 'Ł', 'L' ],
  [ 'ł', 'l' ],
  [ 'ŉ', '\'n' ],
  [ 'Ŋ', 'N' ],
  [ 'ŋ', 'n' ],
  [ 'Œ', 'Oe' ],
  [ 'œ', 'oe' ],
  [ 'Ŧ', 'T' ],
  [ 'ŧ', 't' ],
  [ 'ſ', 's' ]
]);

// Remove accents/diacritics from a string for slug generation. Uses Unicode
// NFD decomposition (broader than lodash — also folds e.g. Vietnamese), then
// maps the non-decomposable Latin letters exactly as lodash's deburr does.
export function deburr(string) {
  const str = string == null ? '' : String(string);
  return str
    .normalize('NFD')
    // Remove combining diacritical marks (U+0300–U+036F).
    .replace(/[̀-ͯ]/g, '')
    // Map the remaining non-decomposable Latin letters.
    .replace(/[À-ɏ]/g, (ch) => DEBURR_SPECIAL[ch] || ch);
}

// Trailing-edge debounce (lodash's default) with the `.cancel()` and
// `.flush()` methods the admin UI relies on. Only the `(fn, wait)` signature is
// used.
export function debounce(fn, wait = 0) {
  let timer = null;
  let lastArgs = null;
  let lastThis = null;

  function invoke() {
    const args = lastArgs;
    const thisArg = lastThis;
    timer = null;
    lastArgs = null;
    lastThis = null;
    return fn.apply(thisArg, args);
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(invoke, wait);
  }

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = null;
    lastArgs = null;
    lastThis = null;
  };

  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      return invoke();
    }
  };

  return debounced;
}

// Invokes `fn` at most once per `wait` ms, honoring the `leading`/`trailing`
// options (both default true, as in lodash) and exposing `.cancel()`. Used for
// scroll/resize handlers.
export function throttle(fn, wait = 0, options = {}) {
  const leading = options.leading !== false;
  const trailing = options.trailing !== false;
  let lastInvoke = 0;
  let timer = null;
  let lastArgs = null;
  let lastThis = null;

  function invoke(time) {
    lastInvoke = time;
    const args = lastArgs;
    const thisArg = lastThis;
    lastArgs = null;
    lastThis = null;
    return fn.apply(thisArg, args);
  }

  function throttled(...args) {
    const now = Date.now();
    if (lastInvoke === 0 && !leading) {
      lastInvoke = now;
    }
    const remaining = wait - (now - lastInvoke);
    lastArgs = args;
    lastThis = this;
    if (remaining <= 0 || remaining > wait) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      invoke(now);
    } else if (!timer && trailing) {
      timer = setTimeout(() => {
        timer = null;
        lastInvoke = leading ? Date.now() : 0;
        invoke(Date.now());
      }, remaining);
    }
  }

  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = null;
    lastInvoke = 0;
    lastArgs = null;
    lastThis = null;
  };

  return throttled;
}
