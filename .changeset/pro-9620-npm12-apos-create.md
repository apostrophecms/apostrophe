---
"create-apostrophe": minor
---

Fixed `npm create apostrophe` with the SQLite database option under npm v12 (and when run from a global `@apostrophecms/cli` install). The installer now performs its post-install database work using the newly generated project's own `better-sqlite3`, rather than the installer's bundled copy.
