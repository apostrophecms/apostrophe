---
"apostrophe": patch
"@apostrophecms/vite": patch
---

Fixed the admin UI sometimes serving a stale build after dependencies changed (for example after `npm install` or `npm update`). Apostrophe now detects dependency changes from the content of the lock file rather than its modified time, which could be misleading after a fresh checkout or a restored CI/Docker build cache.

For external build module authors: lock file change detection now happens in the core and is passed to the build module via the `lockChanged` build option. The `apos.asset.getSystemLastChangeMs()` helper is deprecated and the build manifest no longer includes a `ts` timestamp.
