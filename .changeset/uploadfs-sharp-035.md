---
"uploadfs": minor
---

Upgraded the optional `sharp` image-processing dependency from `^0.32.6` to `^0.35.2`. Since 0.33, sharp distributes its prebuilt binaries as platform-specific `@img/sharp-*` packages, and as of 0.35 it no longer runs an install script (the previous `node-gyp`/`prebuild-install` step). This removes a deprecation warning and prepares projects for npm v12, where dependency install scripts are disabled by default.
