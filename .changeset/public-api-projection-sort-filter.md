---
"apostrophe": patch
---

Security: for anonymous REST API requests restricted by `publicApiProjection`, the `sort` query parameter and the per-field filter query parameters could operate on fields excluded by the projection, revealing the relative order of hidden values or which documents had a given hidden value. Sort keys and field filters not permitted by the projection are now ignored for these requests. In addition, the related pages embedded in anonymous page REST API responses (`_ancestors` and `_children`) were not limited to `publicApiProjection` when the projection included `path`; they now are. Authenticated requests and API key requests are not affected. Only sites that set `publicApiProjection` were affected. Full text search (`search`, `autocomplete`) is unchanged: it covers every field not marked `searchable: false`, exactly as the public site search does, so sensitive text fields should be marked `searchable: false` (CWE-200, CWE-639, GHSA-rqgm-cfrp-4hx8).

Thanks to [N.HARSHA VARDHAN](https://github.com/saiharsha0546-dot) for reporting the vulnerability.
