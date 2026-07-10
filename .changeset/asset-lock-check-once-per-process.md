---
"apostrophe": patch
---

The lock file dependency check that forces a full rebuild now runs once per process. Watcher-triggered rebuilds stay scoped to the detected changes instead of rebuilding everything on every file change when the lock file changed or is absent. This bug was in effect only for projects missing a lock file in their `npmRoot` (e.g. npm monorepos). 
