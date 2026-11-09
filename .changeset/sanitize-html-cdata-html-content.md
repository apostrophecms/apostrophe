---
"sanitize-html": patch
---

Security: outside SVG and MathML, browsers parse `<![CDATA[` as a bogus comment that ends at the first `>`, but the underlying parser read it all the way to `]]>`. Markup between those two points was hidden from sanitize-html, so a start tag for one of the `nonTextTags` (such as `noscript`, `style`, `script`, `textarea` or `xmp`) placed there was not seen, and content the browser would keep inert inside that element was emitted as live markup. Only tags, attributes and URL schemes permitted by the allowlist could be emitted this way. A `<![CDATA[` section now always ends at the first `>`, as it does in HTML content in a browser. As a result, the text of a real CDATA section inside SVG or MathML is now dropped or sanitized as markup instead of being kept as text, and the literal sequence `<![CDATA[` inside an allowed `script` or `style` element is written as `<!&#91;CDATA[` (CWE-79, CWE-436, GHSA-2rjc-9xvg-45j7).

Thanks to [Oscar Rodríguez](https://github.com/Ramiin) for reporting the vulnerability.
