---
"@apostrophecms/db-connect": patch
---

On Postgres, null and missing values now sort lowest in both directions, as on MongoDB; they came first when sorting descending.
