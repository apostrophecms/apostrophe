# create-apostrophe

## 1.2.0 (2026-09-03)

### Fixes

- Fixed a bug that prevented successful installation of dependencies on Windows when not using WSL.
- Reports the actual error message when installation fails, per claims already made in the CLI.

### Adds

- Include the Node.js version and OS name in telemetry (note that telemetry is anonymous, opt-in and only in play when creating projects, to
help us debug issues with the CLI).

## 1.1.0 (2026-07-10)

### Fixes

- Fixed `npm create apostrophe` with the SQLite database option under npm v12 (and when run from a global `@apostrophecms/cli` install). The installer now performs its post-install database work using the newly generated project's own `better-sqlite3`, rather than the installer's bundled copy.

## 1.0.1 (2026-06-10)

### Fixes

- Fixes broken link

## 1.0.0 (2026-06-10)

Initial release.
