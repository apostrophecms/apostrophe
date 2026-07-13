# create-apostrophe

## 1.1.0 (2026-07-10)

### Fixes

- Fixed `npm create apostrophe` with the SQLite database option under npm v12 (and when run from a global `@apostrophecms/cli` install). The installer now performs its post-install database work using the newly generated project's own `better-sqlite3`, rather than the installer's bundled copy.

## 1.0.1 (2026-06-10)

### Fixes

- Fixes broken link

## 1.0.0 (2026-06-10)

Initial release.
