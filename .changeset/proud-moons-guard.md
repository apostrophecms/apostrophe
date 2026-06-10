---
"apostrophe": patch
---

Security fix: server-side prototype pollution (CWE-1321) via dot-notation paths. `apos.util.set()` and `apos.util.get()` now refuse to traverse `__proto__`, `constructor` and `prototype` path segments. Previously an authenticated editor could send a PATCH REST API request whose patch operators (for example `$pullAll` with a key of `__proto__.publicApiProjection`) wrote to `Object.prototype`. A polluted `publicApiProjection` defeated the `publicApiCheck()` authorization gate on piece-type REST endpoints for subsequent unauthenticated requests, for the lifetime of the Node.js process. All users should update. Thanks to [tonghuaroot](https://github.com/tonghuaroot), [H3xV0rT3x](https://github.com/H3xV0rT3x), and [5h1kh4r](https://github.com/5h1kh4r) for reporting the vulnerability.
