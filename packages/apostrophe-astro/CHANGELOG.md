# Changelog

## 1.7.1 (2025-11-25)

* Add support for `sluggo` options in the `slugify` util helper and `stripAccents` option to remove accents from characters.

## 1.7.0 (2025-10-30)

### Adds

* Refactor `AposArea` to accept custom style, class, and attributes, but also a `widgetComponent` prop. The latter is allowing for custom widget rendering components to be used. This is particularly useful for complex widgets like the Layout widget that need to render the output in particular order/way.
* Introduce `LayoutWidget.astro` and `LayoutColumnWidget.astro` components to be used in the project level widget mapping.
* Adds new `AposRenderAreaForAstro` component, specifically designed to be used to implement the new `/api/apos-external-frontend/render-area` route. This allows section template library previews to work in Astro projects and also enables calling the ApostropheCMS REST APIs with `?render-area` when using Astro on the front end. See the documentation for more information on adding this route to existing projects.

## 1.6.0 (2025-10-01)

### Adds

* Adds additional handling for the `@apostrophecms/anchors` module to the `AposWidget.astro` component
* Adds handling for project-level widget options, as well as actually passing per-area options to widgets. Can be accessed through the `options` prop in the widget components.
* Add support for `prependMain` and `appendMain` in the `aposData` object, allowing for custom HTML to be injected into the `<main>` sections of the layout.

### Fixes

* Verify that `Host` header is correctly formatted.

## 1.5.2 (2025-09-09)

### Fixes

* Corrected the link to the astro apollo pro starter kit in the documentation.

## 1.5.1 (2025-09-08)

### Changes

* Guide developers to our actively supported starter kits.

## 1.5.0 (2025-08-06)

### Adds

* Add support for `prependHead`, `appendHead`, `prependBody`, and `appendBody` in the `aposData` object, allowing for custom HTML to be injected into the `<head>` and `<body>` sections of the layout.

### Fixes

* Handle deep schema validation errors when rendering widgets, so that a message is displayed in the widget preview instead of a crash.

## 1.4.0 (2025-06-11)

### Adds

* Add `util` (currently containing only `slugify`) and `attachment` helpers to mimic Apostrophe's Nunjucks helpers.

### Fixes

* Fix duplicate function that breaks project builds.

## 1.3.1 (2025-05-23)

### Fixes

* Fix a bug when the Astro app can crash due to live widget preview in some cases.

## 1.3.0 (2025-04-16)

### Adds

* Add support for decoding the response body needed for some hosting added to the `aposResponse.js`.

## 1.2.1 (2025-03-19)

### Fixes

* The `lang` attribute of the `<html>` tag now respects localization.

## 1.2.0 (2025-01-27)

### Changes

* The configuration array for headers passed from Apostrophe to the browser has been changed from `forwardHeaders` to `includeResponseHeaders` with BC maintained.
* A new configuration option `excludeRequestHeaders` has been added to allow exclusion of headers like `host` being sent from the browser to Apostrophe.
* The `README.MD` has been updated with the new configuration options.
* Clearer error messages have been added to indicate that either the backend server has not been started, or that the `APOS_EXTERNAL_FRONT_KEY` strings don't match.

## 1.1.0 (2024-11-20)

### Adds

* Add support for automated bundles injection in Edit (apos) mode, required for supporting the new core "manifest" builds (when available).

## 1.0.9 (2024-10-23)

* Prevent the `Connection: Upgrade` header from breaking Astro's `fetch` calls to Apostrophe when hosted in an environment that permits websocket upgrades of existing connections.
* Refactored redundant code for building requests with the external front key, etc.

## 1.0.8 (2024-07-02)

* The `renderWidget` route will no longer crash if there was an issue getting the `render-widget` route from Apostrophe (like a mandatory field missing), it will respond with a 500 only, with a log message in the console. Thanks to Michelin for contributing this fix.

## 1.0.7 (2024-03-28)

* Visiting the `/login` page when already logged in no longer results in
an undesired direct response from Apostrophe. Redirects within api routes like the login issued
on the Apostrophe side are now sending a redirect response as per Astro endpoints documentation.
* Page refreshes no longer alternate between displaying the admin UI and not displaying it
with each refresh in certain configurations.
* Thanks to Michelin for collaborating on the solution.

## 1.0.6 (2024-03-26)

* Change the way we fetch from Apostrophe by using `undici` `request` method, so as all headers are correctly forwarded. As on latest Node.js versions, headers like `Host` are no more forwarded by the regular `fetch` global method.

## 1.0.5 (2024-02-07)

* Compatible with Astro's `ViewTransition` feature when editing, via
a workaround. Since this workaround imposes a performance penalty
(only for editors, not the public), the `viewTransitionWorkaround`
option must be set to `true` to enable it.

## 1.0.4 (2024-01-22)

* Documentation fixes only.

## 1.0.3 (2023-12-27)

* Documentation typo that impacts Linux and other case sensitive systems fixed.

## 1.0.2 (2023-12-22)

* Fix bug causing pages to crash after refresh if widget
grouping is used.

## 1.0.1 (2023-12-21)

* Fix bug impacting two-column widgets.

## 1.0.0 (2023-12-21)

* Initial release.
