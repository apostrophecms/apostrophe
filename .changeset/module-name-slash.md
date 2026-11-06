---
"apostrophe": patch
---

A module name with a slash that isn't an npm-style `@namespace/name`, such as `nested/stuff`, now produces a clear startup warning recommending the `nestedModuleSubdirs: true` option. These modules still load as before. The misleading "unused module" warning about the parent folder (`modules/nested`) no longer appears.
