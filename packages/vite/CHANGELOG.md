# Changelog

## 1.2.0 (2026-09-30)

### Changes

- Vite's own build output is indented under the build entry it belongs to in the human log formats, and becomes structured events when the format is machine readable; the build and HMR notices carry event types. A logged error's `stack` is the stack string itself, no longer an array of trimmed lines.
- Assets from a module's `public/` folder that are referenced from CSS, such as web fonts loaded with `url('/modules/...')`, are now emitted at their original path instead of a content-hashed copy under `assets/`. As a result, `apos.asset.url('/modules/...')` in a template now matches the URL requested by the built CSS, so `<link rel="preload">` tags for web fonts work as intended rather than downloading each font twice. Cache busting is still provided by the release directory. Note that Vite still inlines assets smaller than 4 KB into the CSS, so such small fonts should not be preloaded. Also fixes the `assetsDir` build option, which was misspelled and silently ignored.
- Corrected three typos in the README's asset import and `@/` alias documentation.

## 1.1.2 (2026-07-10)

### Fixes

- Fixed the admin UI sometimes serving a stale build after dependencies changed (for example after `npm install` or `npm update`). Apostrophe now detects dependency changes from the content of the lock file rather than its modified time, which could be misleading after a fresh checkout or a restored CI/Docker build cache.

  For external build module authors: lock file change detection now happens in the core and is passed to the build module via the `lockChanged` build option. The `apos.asset.getSystemLastChangeMs()` helper is deprecated and the build manifest no longer includes a `ts` timestamp.

## 1.1.1 (2025-11-25)

### Changes

- Intercept 403 Vite middleware responses to provide helpful error messages for host validation issues.

### Fixes

- Fixes for native Windows Node.js without WSL.

## 1.1.0 (2025-06-11)

### Changes

- Bumbs `eslint-config-apostrophe` to `5`, fixes errors, removes unused dependencies.
- Bumps to `vite@6`
- Bumps `postcss-viewport-to-container-toggle` to `2`.

## 1.0.0 (2024-12-18)

### Fixes

- Uses `postcss-viewport-to-container-toggle` plugin only on `public` builds to avoid breaking apos UI out of `apos-refreshable`.

## 1.0.0-beta.2 (2024-11-20)

### Adds

- Adds postcss supports for the new `postcss-viewport-to-container-toggle` that allows the breakpoint preview feature to work.
- Loads postcss config file from project only for public builds.
- Adds `autoprefixer` plugin only for apos builds.
- Adds module debug logs when in asset debug mode (`APOS_ASSET_DEBUG=1`).
- Adds an option for disabling the module preload polyfill.
- Adds support for `synthetic` entrypoints, that will only process the entrypoint `prologue`.
- Adds support for `Modules/...` alias for the public builds (Webpack BC).
- Our Vite alias plugin now throws with an useful error message when `Modules/` alias resolver fails.
- Adds sass resolver for `Modules/` alias. It works for both public and private builds in exactly the same way as the JS resolver.
- Adds alias `@/` for all builds, that points to the project build source root. This works for both JS and SCSS.

### Fixes

- Don't crash when there is no entrypoint of type `index`.

## 1.0.0-beta.1 (2024-10-31)

- Initial beta release.
