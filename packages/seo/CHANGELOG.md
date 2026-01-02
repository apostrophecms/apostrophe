# Changelog

## 1.3.2 (2025-09-03)

### Changes

* README improved

## 1.3.1 (2025-08-06)

### Changes

* Bumps `eslint-config-apostrophe` to `5`, fixes errors, removes unused dependencies.
* Removes circle ci, adds github actions.
* Inject nodes instead of async Nunjucks component to support external frontends.

## 1.3.0 (2024-10-31)

- Adds a selection for adding a `robots.txt` "file" to the site through the global configuration.

## 1.2.3 (2024-09-05)

* Add AI and community-reviewed translation strings.

## 1.2.2 (2024-08-08)

- Corrected inaccurate information about enabling the module for piece types.
It is enabled by default and can be expressly disabled via `seoFields: false`.
- Edits package description.

## 1.2.1 (2023-11-03)

### Changes

- Removes CircleCI and adds logo. No code changes.

## 1.2.0 (2023-03-29)

### Adds
- Canonical links for pieces, not only for pages from now on.

## 1.1.2 (2023-02-13)

### Changes
- Remove `apostrophe` as a peer dependency.

## 1.1.1 (2021-12-21)

### Adds

- Compatible with the `@apostrophecms/security-headers` module.

## 1.1.0 (2021-10-28)

### Adds

- Adds English (`en`) locale strings for static text.
- Adds Spanish (`es`) localization to static text. Thanks to [Eugenio Gonzalez](https://github.com/egonzalezg9) for the contribution.
- Adds Slovak (`sk`) locale strings for static text. Thanks to [Michael Huna](https://github.com/Miselrkba) for the contribution.

### Fixes

* Fixes the `_seoCanonical` projection option property, previously using Apostrophe 2 syntax.

## 1.0.0 (2021-06-16)

- Initial Apostrophe 3 Release
