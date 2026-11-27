---
"apostrophe": minor
---

A module can keep its UI out of the build with `build.enable`: `false`, or a function of the module's configured options that returns `false`, leaves the module's UI sources and extra bundles out of every build, Vite and webpack alike.
