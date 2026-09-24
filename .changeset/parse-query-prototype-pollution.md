---
"apostrophe": patch
---

Security: the browser-side `apos.http.parseQuery` helper, which the admin UI runs on the current page's query string, let parameter names containing `__proto__`, `constructor` or `prototype` segments modify `Object.prototype`. A crafted link could therefore alter the behavior of the admin UI for a logged-in user who opened it. Such parameters are now ignored, and the parser only descends into the result's own properties. The dot-path setter used to replay undo and redo in areas is hardened the same way (CWE-1321, CWE-79, GHSA-m2m5-rw3w-cwmj).

Thanks to [LoGiCaL__](https://github.com/Xx-LoGiCaL-xX) for responsibly reporting the vulnerability.
