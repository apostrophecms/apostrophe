---
"create-apostrophe": minor
---

`pnpm create apostrophe` now works. The starter kits are npm projects, so the installer says up front that the project will be installed with npm, which comes with Node.js, and then runs as usual. The new project's `package.json` gets a `packageManager` field naming that npm, so a habitual `pnpm install` stops with a clear message instead of converting the project and skipping native builds such as `better-sqlite3`, which would stop the site from starting. The final screen also reminds pnpm users to use npm in the project. yarn is still not supported, but is now refused before the first prompt (not after all of them) with a message saying to re-run with `npm create apostrophe@latest`. A guided install refused this way sends no telemetry, because consent has not been asked yet; unattended runs still report `unsupported_pm`.
