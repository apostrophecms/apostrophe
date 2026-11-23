---
"apostrophe": patch
---

Saving an array field with a `unique` subfield is much faster for large arrays. The check for duplicate values now takes linear time instead of quadratic time. Duplicates are still rejected with the same error.
