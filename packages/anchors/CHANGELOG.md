# Changelog

## 1.1.1 (2026-09-30)

### Changes

- Corrected grammar, removed duplicated lines from the wildcard redirect examples, and dropped an off-topic section from the README documentation.
- Broken links in the README and `package.json` of these packages, as surfaced by their pages on the ApostropheCMS extensions site, are corrected. The license badges pointed at the retired standalone repositories, and in the case of `@apostrophecms/redirect` and `@apostrophecms/form-submission-google` at the Blog module's license rather than their own; "Give us a star on GitHub!" pointed at the archived `apostrophecms/form` and `apostrophecms/anchors` repositories; and `@apostrophecms/import-export` linked `@apostrophecms/import-export-xlsx` to its archived repository. All now resolve within the monorepo. The `@apostrophecms/form` README also linked `@apostrophecms-pro/advanced-permission` to a private repository, which 404s for anyone without access; it now links to the public extension page.

  In `package.json`, `@apostrophecms/favicon` had its `repository.directory` misspelled as `packages/favison` and `@apostrophecms/import-export` had `packages/` missing from its `homepage`. `@apostrophecms/favicon`, `@apostrophecms/anchors` and `@apostrophecms/form-submission-google` were each missing a `bugs` field, so tools that need one derived it from `homepage` and produced an unusable URL. No code changes.

## 1.1.0 (2025-10-01)

* Adds new `annotateWidgetForExternalFront()` method to both modules. This allows for options to be passed through to external frontends like Astro.
* Fixes the `anchorId` field of the `anchors-widget-type` module so that it follows the field passed in the `anchorDefault` option.

## 1.0.2 (2025-08-06)

* README updates.
* Test with supported Node.js and MongoDB versions.

## 1.0.1 (2024-10-31)

* Adds AI-generated and community reviewed missing translations

## 1.0.0 - 2023-01-16

* Declared stable. No code changes. Minor doc improvements.

## 1.0.0-beta - 2021-12-10

* Initial module release supporting widget wrapping for anchor linking.
