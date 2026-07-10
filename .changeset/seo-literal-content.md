---
"@apostrophecms/seo": minor
---

The generated `robots.txt` and `llms.txt` files are now declared as *literal content* routes, so external front-end integrations (such as the Astro integration) serve them correctly in SSR mode automatically, with no per-route configuration. Requires a compatible version of Apostrophe core.
