---
"sanitize-html": patch
---

Security: fixed an XSS / URL scheme policy bypass affecting configurations that allow the SVG animation elements (`animate`, `animateColor`, `animateMotion`, `animateTransform` or `set`) together with `attributeName` and one of the animation value attributes. The default configuration was not affected, as these elements are not in the default `allowedTags`. `apostrophecms` was not affected. Thanks to [koyokr](https://github.com/koyokr) for responsibly disclosing the vulnerability (GHSA-g8qq-57p8-ggw5).
