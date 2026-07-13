---
"apostrophe": patch
---

Reduced the size of the logged-in admin UI JavaScript bundle by roughly 200KB minified (about 90KB gzipped) with no change in behavior. Neither `lodash` nor `@paralleldrive/cuid2` is bundled into the admin UI any more; the few things the browser needed from them now come from small, dependency-free implementations in `apostrophe/lib/beneath.js`, which browser code imports explicitly.

- lodash (previously ~165KB, in part duplicated) is gone. `lodash` is CommonJS and not tree-shakeable, so a single `import { isEqual } from 'lodash'` pulled the whole library in for one function. The handful of methods the admin UI uses (`isEqual`, `get`, `merge`, `isPlainObject`, `deburr`, `debounce`, `throttle`) are now in `beneath.js`, fuzz-tested against the real lodash.
- `@paralleldrive/cuid2` (which drags in `@noble/hashes`, and under some dependency layouts `bignumber.js`) is gone from the bundle. `beneath.js` exports a `createId()` that produces the same 24-character id shape using the Web Crypto API, with uniform character distribution. Server-side id generation elsewhere (`apos.util.generateId`) still uses the real cuid2.
- Because these are ordinary module imports rather than build-time aliases, the change applies to any bundler (Vite and webpack), and the source honestly shows where these functions come from. `beneath.js` is an ES module; the one universal file that also uses it on the server (`schema/lib/newInstance.js`) `require()`s it, so **Apostrophe now requires Node 22.12 or newer** (for `require(esm)`). The package's `engines` field has been updated accordingly.
