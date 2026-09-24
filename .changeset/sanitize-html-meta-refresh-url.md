---
"sanitize-html": patch
---

Security: when `meta` was allowed together with its `http-equiv` and `content` attributes, the destination URL of a `<meta http-equiv="refresh" content="0;url=...">` was never checked against `allowedSchemes`, because it is embedded in `content` rather than being an attribute of its own. So `javascript:`, `data:` and other disallowed destinations passed through. The refresh URL is now extracted the way browsers do it, allowing for the different spellings, separators, quoting and letter case of `url=`, and checked against `allowedSchemes` (or `allowedSchemesByTag.meta`). If it is rejected, or the content cannot be parsed as a refresh, the `content` attribute is removed. `content` on other `meta` elements is unchanged. The default configuration does not allow `meta` and was not affected (CWE-79, CWE-601, GHSA-cv27-6wvh-8x7j).

Thanks to [adrbogacz](https://github.com/adrbogacz) for responsibly reporting the vulnerability.
