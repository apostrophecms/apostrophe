---
"apostrophe": patch
---

Switching to a locale served from another hostname now keeps the user logged in when the cache is provided by `@apostrophecms/cache-redis` or another alternative cache implementation. The token that carries the session to the other hostname is now removed with the public `apos.cache.delete` method, rather than by accessing the default cache's MongoDB collection directly. `apos.cache.delete` now resolves to the number of entries removed, as it already did in `@apostrophecms/cache-redis`.
