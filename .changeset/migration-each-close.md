---
"apostrophe": patch
---

`apos.migration.each` now closes its cursor when the iterator throws, instead of leaving it open (PRO-10051).
