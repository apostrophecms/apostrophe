---
"sanitize-html": patch
---

`allowedSchemesByTag` is now applied to `srcset` and `imagesrcset` URLs. Previously the per-tag lookup used the attribute name instead of the tag name, so these attributes always fell back to the global `allowedSchemes` and ignored a tag-specific scheme allowlist.
