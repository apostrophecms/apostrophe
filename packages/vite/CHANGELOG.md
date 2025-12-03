# Changelog

## 1.1.1 (2025-11-25)

### Changes

* Intercept 403 Vite middleware responses to provide helpful error messages for host validation issues.

### Fixes

* Fixes for native Windows Node.js without WSL.

## 1.1.0 (2025-06-11)

### Changes

* Bumbs `eslint-config-apostrophe` to `5`, fixes errors, removes unused dependencies.
* Bumps to `vite@6`
* Bumps `postcss-viewport-to-container-toggle` to `2`.

## 1.0.0 (2024-12-18)

### Fixes

* Uses `postcss-viewport-to-container-toggle` plugin only on `public` builds to avoid breaking apos UI out of `apos-refreshable`.

## 1.0.0-beta.2 (2024-11-20)

### Adds

* Adds postcss supports for the new `postcss-viewport-to-container-toggle` that allows the breakpoint preview feature to work.
* Loads postcss config file from project only for public builds.
* Adds `autoprefixer` plugin only for apos builds.
* Adds module debug logs when in asset debug mode (`APOS_ASSET_DEBUG=1`).
* Adds an option for disabling the module preload polyfill.
* Adds support for `synthetic` entrypoints, that will only process the entrypoint `prologue`.
* Adds support for `Modules/...` alias for the public builds (Webpack BC). 
* Our Vite alias plugin now throws with an useful error message when `Modules/` alias resolver fails.
* Adds sass resolver for `Modules/` alias. It works for both public and private builds in exactly the same way as the JS resolver.
* Adds alias `@/` for all builds, that points to the project build source root. This works for both JS and SCSS.

### Fixes

* Don't crash when there is no entrypoint of type `index`.

## 1.0.0-beta.1 (2024-10-31)

* Initial beta release.
