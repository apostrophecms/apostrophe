---
"@apostrophecms/db-connect": patch
---

The postgres cursor returns its pooled connection when iteration stops early: on a query error inside `next()`, and when a `for await` loop exits through `break`, `return` or a throwing body. Previously each abandoned cursor kept a connection checked out for the life of the process  (PRO-10051).
