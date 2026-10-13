---
"sanitize-html": patch
---

Security: since 2.18.0, the fallback markup of a discarded `<iframe>` was re-sanitized by a recursive call with no limit, one level per nested unclosed `<iframe>`. A few kilobytes of crafted input could throw `RangeError: Maximum call stack size exceeded` with the default options, and the `nestingLimit` option was not enforced across the fallback because each nested call started counting from zero. The fallback of a discarded `<iframe>` is still sanitized and kept, but only up to eight nested `<iframe>` elements (deeper fallback is escaped as text, as before 2.18.0), and the current nesting depth now carries into the nested call so `nestingLimit` applies to the whole output. Only 2.18.0 was affected, and the exception is thrown synchronously, so applications that catch errors from `sanitizeHtml` only lost the affected request (CWE-674, GHSA-c9rx-x947-fp3h).

Thanks to [hkmj19](https://github.com/hkmj19), [JohnBeckley](https://github.com/JohnBeckley), and [amikhailovstiltsoft](https://github.com/amikhailovstiltsoft) for reporting the vulnerability.
