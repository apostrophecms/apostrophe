---
"sanitize-html": patch
---

Security: when `style` was allowed together with `svg` or `math`, the content of a `<style>` element could be emitted as live markup. The underlying parser and browsers do not always agree on whether a `<style>` is an HTML element, whose content is raw CSS text, or an SVG/MathML element, whose content is markup: for example the parser treats `annotation-xml` as an HTML integration point regardless of its `encoding` attribute, and inside `svg` or `math` it decodes `&lt;` in style content. Because sanitize-html emitted style content as is, markup that the allowlist never permitted, including event handler attributes, could reach the browser. A `<` in style content is now written as the equivalent CSS escape `\3c `, which means the same in a stylesheet and cannot open a tag. Exposure is limited: `style` is not allowed by default, it is one of the `vulnerableTags` that sanitize-html warns about unless `allowVulnerableTags` is set, and allowing it already permits CSS-based attacks; `svg` or `math` must also be allowed. Since 2.17.6 (CWE-79, GHSA-6wrv-5cp6-h3c5).

Thanks to [Ali Mustafa](https://github.com/rz1027) for reporting the vulnerability.
