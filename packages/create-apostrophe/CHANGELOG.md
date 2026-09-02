# create-apostrophe

## 1.2.0-alpha.2

### Patch Changes

- c416c12: Fixed the installer reporting a failed step with no explanation. On failure it printed "See the messages above for the underlying error", but the failing child process's output was captured and discarded, so there were no messages above — nothing was left to go on but a stage name and an error code. Failures of `npm install` and of the `@apostrophecms/user:add` / `@apostrophecms/user:change-password` tasks now print the tail of the child's own output (the last 30 lines, since that is where the actual error is). This matters most at the admin-account step: it is the first thing that boots the newly generated project's Apostrophe, so a startup problem of any kind — a bad database connection string, a missing dependency — surfaces there and was previously invisible. The output is written to the terminal only; telemetry continues to receive nothing but the symbolic error code.
- Updated dependencies [c416c12]
  - @apostrophecms/db-connect@1.0.2-alpha.0

## 1.2.0

### Minor Changes

- cc8b80a: - Fix a bug that prevented successful installation of dependencies on Windows when not using WSL.
  - Include the Node.js version and OS name in telemetry.

## 1.1.0 (2026-07-10)

### Fixes

- Fixed `npm create apostrophe` with the SQLite database option under npm v12 (and when run from a global `@apostrophecms/cli` install). The installer now performs its post-install database work using the newly generated project's own `better-sqlite3`, rather than the installer's bundled copy.

## 1.0.1 (2026-06-10)

### Fixes

- Fixes broken link

## 1.0.0 (2026-06-10)

Initial release.
