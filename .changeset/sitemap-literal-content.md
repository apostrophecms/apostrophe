---
"@apostrophecms/sitemap": minor
---

The generated `sitemap.xml` (or per-locale sitemaps) is now declared as a *literal content* route, so external front-end integrations (such as the Astro integration) serve it correctly in SSR mode automatically, with no per-route configuration. Requires a compatible version of Apostrophe core.
