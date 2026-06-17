---
"@apostrophecms/redirect": minor
---

New `caseInsensitive` option. When enabled, "Old URL" values are stored in lowercase and incoming request URLs are matched case-insensitively. A migration lowercases existing redirects when the option is enabled. See the README for details, including a note on the non-reversible nature of this change.
