---
"apostrophe": patch
---

Fixed `piecesFilters` navigation (with `static: true`) reverting to the unfiltered index when logged in and an editor had clicked Edit at least once. It now recognizes filter path segments appended to the context doc's URL and preserves both the browser URL and the correctly filtered content on refresh.
