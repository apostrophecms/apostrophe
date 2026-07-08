---
"sanitize-html": patch
---

Security: fixed an XSS/allowlist bypass in which the contents of a raw-text
element (`textarea` or `xmp`) nested inside an `svg` or `math` root were
re-emitted without HTML-escaping. `sanitize-html` treated that content as inert
raw text because `htmlparser2` classifies raw-text elements by tag name and
ignores the namespace, but a real HTML5 parser treats `textarea`/`xmp` as
ordinary foreign elements inside SVG/MathML and re-parses their contents as live
markup. As a result, markup and event-handler attributes that the allowlist
never permitted (for example `<svg><textarea><img src=x onerror=alert(1)>`)
could survive sanitization and execute in the browser. Raw-text content is now
HTML-escaped whenever it appears anywhere inside an `svg` or `math` subtree. The
default configuration is not affected; the precondition is an `allowedTags` that
includes `svg` or `math` together with `textarea` or `xmp`. Thanks to
[khoadb175](https://github.com/khoadb175) for responsibly disclosing the
vulnerability.
