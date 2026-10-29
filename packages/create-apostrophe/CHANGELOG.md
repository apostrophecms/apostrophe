# create-apostrophe

## 1.3.0 (2026-10-29)

### Adds

- `pnpm create apostrophe` now works. The starter kits are npm projects, so the installer says up front that the project will be installed with npm, which comes with Node.js, and then runs as usual. The new project's `package.json` gets a `packageManager` field naming that npm, so a habitual `pnpm install` stops with a clear message instead of converting the project and skipping native builds such as `better-sqlite3`, which would stop the site from starting. The final screen also reminds pnpm users to use npm in the project. yarn is still not supported, but is now refused before the first prompt (not after all of them) with a message saying to re-run with `npm create apostrophe@latest`. A guided install refused this way sends no telemetry, because consent has not been asked yet; unattended runs still report `unsupported_pm`.

### Fixes

- Telemetry for an install that stops before any stage runs (for example, an unsupported package manager) now reports `failStage` as `preflight` instead of `null`, so the field always has the same type.
- The installer now runs `npm install` a second time in each project folder. Without a lockfile, npm's first install of a fresh project isn't final: on macOS it leaves out `fsevents`, which `npm run dev` uses for file watching, and it can place a dependency where the next install moves it. The second run settles the project so a later `npm install` makes no changes. It takes a few seconds, and if it fails the install still succeeds.

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
