---
"@apostrophecms/sitemap": patch
---

Per-locale sitemap generation (`perLocale: true`) now uses the scheme (`http`/`https`) of the site's configured `baseUrl` for locales with their own hostname (`separateHost: true` / a `hostname` locale option), instead of always defaulting to `http`. Previously, `<loc>` and `xhtml:link hreflang` URLs for such locales could be emitted as `http://` even when the site and that host are served exclusively over HTTPS.
