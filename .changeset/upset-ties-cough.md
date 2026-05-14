---
"sanitize-html": patch
---

Security vulnerability: the xmp tag could be used to pass forbidden markup through sanitize-html, even when xmp itself is not explicitly allowed All users of sanitize-html should update immediately. Thanks to [Vincenzo Turturro](https://github.com/sushi-gif) for reporting the vulnerability.
