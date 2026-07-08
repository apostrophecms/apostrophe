---
"sanitize-html": patch
---

Security: fixed an XSS/allowlist bypass in which the contents of a raw-text
element (`textarea` or `xmp`) nested inside an `svg` or `math` root were
re-emitted without HTML-escaping. `sanitize-html` treated that content as inert
raw text because `htmlparser2` 10.x classified raw-text elements by tag name and
ignored the namespace, but a real HTML5 parser treats `textarea`/`xmp` as
ordinary foreign elements inside SVG/MathML and re-parses their contents as live
markup. As a result, markup and event-handler attributes that the allowlist
never permitted (for example `<svg><textarea><img src=x onerror=alert(1)>`)
could survive sanitization and execute in the browser. This is now fixed on two
fronts: `htmlparser2` was upgraded to 12.x, which is namespace-aware and parses
`textarea`/`xmp` inside SVG/MathML as ordinary elements, so their
non-allowlisted children (such as the injected `img`) are dropped by the
allowlist instead of being preserved as raw text; and any raw-text content
`sanitize-html` still emits for these tags (at HTML integration points such as
`foreignObject`/`mtext`, or outside foreign content) is always HTML-escaped. The
default configuration is not affected; the precondition is an `allowedTags` that
includes `svg` or `math` together with `textarea` or `xmp`. Thanks to
[khoadb175](https://github.com/khoadb175) for responsibly disclosing the
vulnerability.
