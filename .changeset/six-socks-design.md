---
"@apostrophecms/apostrophe-astro": minor
---

- Replace vite-plugin-apostrophe-config and vite-plugin-apostrophe-doctype with
  vite/vite-plugin-apostrophe-generated-config.js, which writes real files to
  node_modules/.apostrophe-astro-config/ (config.js, doctypes.js)
- Register Vite aliases for apostrophe-astro-config/config and /doctypes
- Update all internal virtual: imports to alias specifiers
- Rename static build cache dir to node_modules/.apostrophe-astro-static/
- Add helpers/server/ (aposFetch, getAposHost, isStaticBuild)
- Add helpers/universal/ (URL, slug, styles, attachment helpers)
- Keep lib/aposPageFetch.js as the internal implementation (starter kit entrypoint only)
- Reduce lib/util.js, lib/aposSetQueryParameter.js, lib/static.js to deprecated shims
- Add MIGRATION.md
- Bump `undici` to ^7.x for Node.js 24+ compatibility
- Add `peerDependencies` declaring Astro v5, v6, and v7 support.
- Fix `virtual:apostrophe-config` import in `aposLiteralContentMiddleware.js` to use the generated-file module path.
- Drop deprecated entryPoint shim from injectRoute calls.
