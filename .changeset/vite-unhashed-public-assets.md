---
"@apostrophecms/vite": minor
---

Assets from a module's `public/` folder that are referenced from CSS, such as web fonts loaded with `url('/modules/...')`, are now emitted at their original path instead of a content-hashed copy under `assets/`. As a result, `apos.asset.url('/modules/...')` in a template now matches the URL requested by the built CSS, so `<link rel="preload">` tags for web fonts work as intended rather than downloading each font twice. Cache busting is still provided by the release directory. Note that Vite still inlines assets smaller than 4 KB into the CSS, so such small fonts should not be preloaded. Also fixes the `assetsDir` build option, which was misspelled and silently ignored.
