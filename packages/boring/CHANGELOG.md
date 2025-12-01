# Changelog

## 1.1.1

* Edits project metadata and README.

## 1.1.0

Added the `end` option, which can be used to indicate that no more named options should be parsed after `--` is encountered, and all remaining arguments should be captured in `argv._`, even if they begin with `--`. The `--` itself is not captured.

## 1.0.0

Official stable release, four years after the "0.1.0" release, which was... well... boring and stable in its own right.

However, we did fix two things:

* `const` and `let` used in place of `var`; this is 2019.
* `--uri=mongodb://something?foo=bar` now behaves sensibly, coming through as `argv.uri`. Formerly it was confused by the extra `=` in the query string of the uri.

We hope you find this as boring as we do.
