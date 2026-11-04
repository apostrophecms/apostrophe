---
"apostrophe": patch
---

Startup errors about configured bundles, such as a bundle that is installed but not listed as a dependency in `package.json`, are thrown as real errors, so the log shows their message and stack instead of `startup-error` with nothing more.
