---
"@apostrophecms/cli": minor
---

- Support for hybrid ApostropheCMS + Astro projects in the `create` command. Projects with a `backend/` directory are automatically detected and handled appropriately.
- Updated the default Astro starter example in the README to use `astro-public-demo`.

- The `add` command now displays an error when run inside a hybrid Astro project, as it is not currently supported in that context.

- The default starter kit is now `public-demo`
