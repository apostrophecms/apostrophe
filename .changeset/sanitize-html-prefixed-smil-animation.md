---
"sanitize-html": patch
---

Security: the check that drops SVG animation elements (`animate`, `animateColor`, `animateMotion`, `animateTransform`, `set`) when they retarget a URL attribute such as `href` compared the full tag name, so a namespace-prefixed spelling like `svg:animate` was not recognized when such tags were allowed (for example with `allowedTags: false`). In XML serializations such as XHTML or standalone SVG, the prefixed element is a real animation element and could retarget a link to a `javascript:` URL after sanitization. The element and `attributeName` are now matched by their local names, ignoring any prefix (CWE-79, CWE-184, GHSA-374f-7chj-9948).

Thanks to [SnailSploit | Kai Aizen](https://github.com/SnailSploit) for responsibly reporting the vulnerability.
