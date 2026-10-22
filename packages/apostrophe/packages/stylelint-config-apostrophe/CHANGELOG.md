# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 4.4.0 (2025-10-01)

### Changed

* Add global mixins to the `@apostrophecms/stylelint-no-mixed-decls` plugin configuration.

## 4.3.0 (2025-06-11)

### Changed

* Extract `custom/require-nested-after-include` rule to a standalone `@apostrophecms/stylelint-no-mixed-decls` plugin and use it.

## 4.2.2 (2025-01-27)

### Changed

* Revert the removal of the `scale-unlimited/declaration-strict-value` rule that was added in 4.2.1. The deprecation warning has been [resolved in v1.10.7](https://github.com/AndyOGo/stylelint-declaration-strict-value/issues/379#issuecomment-2576107022) of the plugin.

## 4.2.1 (2024-12-18)

### Fixed

* Remove the following rule:
```json
"scale-unlimited/declaration-strict-value": [
  ["/color/", "font", "font-family", "z-index"],
  {
    "ignoreKeywords": [
      "currentColor",
      "inherit",
      "initial",
      "transparent",
      "auto",
      "unset"
    ],
    "disableFix": true
  }
],
```
until this issue is resolved: https://github.com/AndyOGo/stylelint-declaration-strict-value/issues/379

## 4.2.0 (2024-09-24)

### Changed

* Replace deprecated `at-import-partial-extension` with `load-partial-extension`.
* Add "custom/require-nested-after-include" rule to enforce the new Sass "Mixed Declarations" rule (see https://sass-lang.com/documentation/breaking-changes/mixed-decls/).

## 4.1.0 (2024-06-12)

### Added

- Include `postcss-scss` to parse Scss files correctly

### Changed

- Allows `%` unit for `border-radius`.
- Allows imports before `$` variables in blocks.
- Allows `unset` for any property checked in `scale-unlimited/declaration-strict-value`

## 4.0.0 (2024-05-15)

### Fixed

- Add support for vue files by using `stylelint-config-html/vue`.

## 3.0.2 (2024-03-08)

### Changed

- Add flexibility for `@extend` and `@include` and force `@media` last.

## 3.0.1 (2024-01-10)

### Changed

- Removed logic to automatically detect out of date stylelint plugins. Unfortunately, this [fails in an
unrecoverable way with the latest versions of some stylelint plugins](https://github.com/nodejs/node/issues/33460), breaking `npm install`.

## [3.0.0] - 2023-06-21

### Changed

- Upgraded dependencies

### Removed

- After upgrading to Stylelint 15, 76 rules that enforce stylistic conventions had been deprecated. They have been removed from the config.

## [2.0.0] - 2022-10-03

### Added

- Update dependencies and rules for stylelint v14+, remove `peerDependencies` package property.

## [1.1.0] - 2021-10-28

### Added

- Ignores inside CSS and preprocessor functions for the `declaration-property-unit-allowed-list` rule. Those functions do not represent the ultimate property unit after compiling.
- Adds eslint to test script and uses Apostrophe eslint config package.

## [1.0.1] - 2021-03-24

### Fixed

- Update to prevent false positives when running `compare`

## [1.0.0] - 2021-01-27

### Added

- Initial release of an ApostropheCMS team stylelint configuration. This is based on `stylelint-config-punkave` rules, with additional scripts for keeping up to date with the standard stylelint config.

[1.0.1]: https://github.com/apostrophecms/stylelint-config-apostrophe/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/apostrophecms/stylelint-config-apostrophe/releases/tag/1.0.0
