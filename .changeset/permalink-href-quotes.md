---
"apostrophe": patch
---

Rich text permalinks are now substituted as quoted `href` attributes. `linkPermalinks` had been dropping both quotes since permalinks were introduced, emitting `<a href=/contact>` rather than `<a href="/contact">`. Browsers tolerate an unquoted attribute value, so the markup usually behaved, but a URL containing a space became two attributes. This affects rich text everywhere, both widgets and `richText` schema fields, since both share `linkPermalinks`.
