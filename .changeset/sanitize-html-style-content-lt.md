---
"sanitize-html": patch
---

Security: when `style` was allowed, the content of a `<style>` element inside `svg` or `math` could be emitted as live markup, even when `svg` and `math` themselves were not allowed. The underlying parser and browsers do not always agree on whether such a `<style>` is an HTML element, whose content is raw CSS text, or an SVG/MathML element, whose content is markup: for example a `<style>` inside MathML `annotation-xml` without an HTML `encoding` is a MathML element to a browser but raw text to the parser, and inside `svg` or `math` the parser decodes `&lt;` in its content. Because sanitize-html emitted style content as is, markup that the allowlist never permitted, including event handler attributes, could reach the browser. Inside `svg` or `math`, a `<` in style content is now written as the equivalent CSS escape `\3c `, which means the same in a stylesheet and cannot open a tag. Other stylesheets are unchanged. Exposure is limited: `style` is not allowed by default, it is one of the `vulnerableTags` that sanitize-html warns about unless `allowVulnerableTags` is set, and allowing it already permits CSS-based attacks (CWE-79, GHSA-6wrv-5cp6-h3c5).

Thanks to [Ali Mustafa](https://github.com/rz1027) for reporting the vulnerability.
