---
"launder": patch
---

`launder.date` no longer returns a malformed string such as `0not-0a-date` when the input contains `-` or `/` but is not made of numbers. Such input now gets the default, as documented, and an ISO 8601 date and time such as `2015-02-19T10:30:00` is reduced to its date. When the optional `now` argument is passed, the date being sanitized is no longer replaced by `now`: a `Date` object keeps its own date, and unparseable input returns the default.
