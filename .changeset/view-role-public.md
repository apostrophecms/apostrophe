---
"apostrophe": patch
---

Security: a doc type's `viewRole` option did not apply to the general public (logged-out visitors), only to logged-in users below the required role. As a result, the public could load `@apostrophecms/user` docs, which have `viewRole: 'admin'`, through a relationship, e.g. via a piece type's REST API `publicApiProjection` or a template. `viewRole` was always intended to apply to the public as well, and this was a bug that should not have been relied upon. The public, and any user without a recognized role, now rank below `guest`, so `viewRole` (as well as `editRole` and `publishRole`) restricts them as intended. **This may change what your site displays:** if your templates or public APIs show users reached through a relationship (for instance as the author of an article), those users will no longer be loaded for logged-out visitors. Use a separate piece type, such as an "author" type, to represent people publicly (CWE-863, GHSA-xf6w-q65w-4f2w).
