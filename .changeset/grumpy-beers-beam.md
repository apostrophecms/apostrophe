---
"@apostrophecms/import-export-xlsx": minor
---

Replaced the off-registry SheetJS `xlsx` tarball dependency with the registry-published `@e965/xlsx` mirror, which exposes the same SheetJS Community Edition API. The module now installs entirely from the npm registry, avoiding install failures on networks restricted to the registry and the npm v12 restriction on non-registry (remote tarball) sources.
