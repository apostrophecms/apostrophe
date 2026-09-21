---
"@apostrophecms/db-connect": patch
---

The postgres adapter's `sort()` orders numbers numerically instead of as text, so `10` no longer sorts before `2` and the children of a page with ten or more of them stay in rank order (PRO-10055).
