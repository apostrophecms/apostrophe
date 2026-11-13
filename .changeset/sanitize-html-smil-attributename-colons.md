---
"sanitize-html": patch
---

Security: the check that drops SVG animation elements (`animate`, `animateColor`, `animateMotion`, `animateTransform`, `set`) when they retarget a URL attribute such as `href` took only the part of `attributeName` after its last colon as the target. Browsers split a name with more than one colon differently, and current Chrome resolves a spelling such as `xlink:href:x` to `xlink:href`, so the animation was kept and could retarget a link to a `javascript:` URL after sanitization. Every colon-separated part of `attributeName`, and of the element name, is now matched. The default configuration is not affected: it only applies when animation elements are allowed together with `attributeName` and an animation value attribute such as `values` or `to` (CWE-79, CWE-184, GHSA-8g6g-w2rq-xcmc).

Thanks to [Zachariah Mithani](https://github.com/zachariah-mithani) for reporting the vulnerability.
