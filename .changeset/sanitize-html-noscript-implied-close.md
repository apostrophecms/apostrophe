---
"sanitize-html": patch
---

Security: when `noscript` is listed in `nonTextTags`, the discarded region could end too early. Browsers with scripting enabled treat `<noscript>` content as raw text up to the first `</noscript>`, but the underlying parser treats it as markup, so an end tag for an enclosing element inside `<noscript>` closed it implicitly and the rest of its content was emitted as ordinary sanitized markup. The discard region now continues until the point where a browser would end the `<noscript>` element, while implied closes of other `nonTextTags` such as `<option>` behave as before (CWE-79, CWE-436, GHSA-x3q4-9hxx-gx8m).

Thanks to [joaquiniglesiaslug](https://github.com/joaquiniglesiaslug) for responsibly reporting the vulnerability.
