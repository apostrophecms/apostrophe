---
"apostrophe": patch
---

Apostrophe now refuses to start, with an explanation, when a module name contains a slash but is not an npm-style `@namespace/name`. Previously a name like `nested/stuff` loaded from a subfolder and produced a confusing "unused module" warning for the parent folder. To organize project modules into subfolders, use the `nestedModuleSubdirs: true` option.
