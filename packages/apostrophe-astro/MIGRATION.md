# Migrating to @apostrophecms/apostrophe-astro v1.13

## Astro v6 support

v1.13 adds support for Astro v6 (Vite 7). Astro v5 continues to work.

---

## Astro v6: remove `security.allowedDomains` from static builds

If your project uses `security.allowedDomains` in `astro.config.mjs` **and** runs static builds, guard it to SSR-only. In a static build Astro v6 reads `request.headers` to validate forwarded headers even during prerendering, producing a spurious warning for every page:

```
[WARN] `Astro.request.headers` was used when rendering the route `src/pages/[...slug].astro`
```

`allowedDomains` has no effect during prerendering (there are no real HTTP headers at build time), so the fix is straightforward:

```js
// astro.config.mjs
const isStatic = process.env.APOS_BUILD === 'static'; // or however you detect it

export default defineConfig({
  output: isStatic ? 'static' : 'server',
  // Only configure allowedDomains for SSR — it is meaningless during
  // static prerendering and triggers a spurious headers warning in Astro v6.
  ...(!isStatic && {
    security: { allowedDomains }
  }),
  // ...
});
```

---

## Deprecated: direct `lib/` imports for public helpers

Some `lib/` paths are deprecated in favour of the stable helper entry points. Note that `lib/aposPageFetch.js` is **not** deprecated — it is an internal function used by the starter kit's `[...slug].astro` entrypoint and is not part of the public API.

| Old import | New import |
|---|---|
| `@apostrophecms/apostrophe-astro/lib/static.js` | `@apostrophecms/apostrophe-astro/helpers/server` (`getAllStaticPaths`, `getAllUrlMetadata`, `getLocales`) |
| `@apostrophecms/apostrophe-astro/lib/aposSetQueryParameter.js` | `@apostrophecms/apostrophe-astro/helpers/universal` (`aposSetQueryParameter`) |
| `@apostrophecms/apostrophe-astro/lib/util.js` | `@apostrophecms/apostrophe-astro/helpers/universal` (`slugify`, etc.) |
| `@apostrophecms/apostrophe-astro/lib/aposStyles.js` | `@apostrophecms/apostrophe-astro/helpers/universal` (`stylesAttributes`, `stylesElements`) |
| `@apostrophecms/apostrophe-astro/lib/attachment.js` | `@apostrophecms/apostrophe-astro/helpers/universal` (`getAttachmentUrl`, `getAttachmentSrcset`, etc.) |

Example:

```js
// Before
import { getAllStaticPaths } from '@apostrophecms/apostrophe-astro/lib/static.js';

// After
import { getAllStaticPaths } from '@apostrophecms/apostrophe-astro/helpers/server';
```

---

## Removed: Vite virtual modules

`virtual:apostrophe-config` and `virtual:apostrophe-doctypes` were private implementation details and are no longer available. If you were importing either of these directly, remove those imports — there is no public replacement, as they were never part of the supported API.
