---
"eslint-config-apostrophe": minor
---

`no-console` is now a warning for server-side code, where diagnostics belong in Apostrophe's log pipeline rather than on the console; it was already an error in browser and test code. A new `eslint-config-apostrophe/strict` entry point promotes it to an error for projects ready to enforce it. Browser code in `ui/` written as `.mjs` is now recognized as browser code, like its `.js` neighbors.
