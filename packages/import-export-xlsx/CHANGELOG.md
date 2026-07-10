# Changelog

## 1.1.0 (2026-07-10)

### Changes

- Replaced the off-registry SheetJS `xlsx` tarball dependency with the registry-published `@e965/xlsx` mirror, which exposes the same SheetJS Community Edition API. The module now installs entirely from the npm registry, avoiding install failures on networks restricted to the registry and the npm v12 restriction on non-registry (remote tarball) sources.

## 1.0.0 (2024-05-15)

### Adds

- Initial release.
