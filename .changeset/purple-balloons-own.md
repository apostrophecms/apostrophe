---
"apostrophe": patch
---

Fixes an issue where the frontend was caching stale choices for `select`, `radio` and `checkboxes` fields that were saved but no longer valid (i.e removed from the schema).
