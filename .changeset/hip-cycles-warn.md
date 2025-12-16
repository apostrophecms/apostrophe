---
"apostrophe": minor
---

Bumped dependency on `express-cache-on-demand` to guarantee installation of recent fixes for edge cases that could share a response between two locales of a single-site project, report errors without a process restart, and correctly handle `res.send('')` with an empty string.
