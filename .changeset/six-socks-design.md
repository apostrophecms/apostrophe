---
"@apostrophecms/apostrophe-astro": major
---

- Replace vite-plugin-apostrophe-config and vite-plugin-apostrophe-doctype with
  vite/vite-plugin-apostrophe-generated-config.js, which writes real files to
  node_modules/.apostrophe-astro-config/ (config.js, doctypes.js)
- Register Vite aliases for apostrophe-astro-config/config and /doctypes
- Update all 10 internal virtual: imports to alias specifiers
- Rename static build cache dir to node_modules/.apostrophe-astro-static/
- Add helpers/server/ (aposFetch, aposPageFetch, getAposHost, isStaticBuild)
- Add helpers/universal/ (URL, slug, styles, attachment helpers)
- Add helpers/client/index.js (reserved)
- Reduce lib/aposPageFetch.js, lib/util.js, lib/aposSetQueryParameter.js to deprecated shims
- Add package.json exports map; bump version to 2.0.0
- Add MIGRATION.md
