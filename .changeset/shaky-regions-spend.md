---
"@apostrophecms/seo": minor
---

Removes the `seoSiteCanonicalUrl` field from global settings. The base URL is now derived automatically from `APOS_BASE_URL` or the `baseUrl` option. The value remains available at `req.data.global.seoSiteCanonicalUrl` for backwards compatibility.
