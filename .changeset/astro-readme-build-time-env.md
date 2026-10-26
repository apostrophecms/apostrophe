---
"@apostrophecms/apostrophe-astro": patch
---

The README no longer says that `APOS_HOST` and `APOS_PREFIX` override the `aposHost` and `aposPrefix` options "at runtime". Both variables are read once, when `astro build` runs, and the resolved values are written into the build output, so they must be set in the build environment and a change requires a rebuild. The README and the JSDoc for the integration options now say so. No code changes.
