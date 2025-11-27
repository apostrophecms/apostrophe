# Changelog

## 2.1.0 (2025-11-25)

### Adds
* Refactors the `AtRule` to handle Tailwind 4.x nesting of media queries

### Fixed

* Changes the wrapping of the `:where()` pseudoclass so that it doesn't set specificity of some elements to `0`, resulting in a broken cascade.

## 2.0.1 (2025-08-06)

### Fixed

* Add `:where()` pseudo-class back to fix specificity issues.

## 2.0.0 (2025-06-06)

### Adds

* Supports body style in and out of media queries. Also supports body style applied to indentifiers like ids and classes if they exist on the body tag. 
Uses the new `[data-apos-refreshable-body]` that exists and replace the body in breakpoint preview in core.

## 1.1.0 (2025-03-19)

### Adds

* Expands handling and conversion of more media queries and units

## 1.0.0 (2024-11-07)

### Adds

* Creates a unique plugin to handle toggle between viewport and container mode when body has a specific attribute.
* Setups mocha tests for the plugin.
