---
"apostrophe": patch
---

Completed the fix for server-side prototype pollution via dot-notation paths (CWE-1321, GHSA-vmg4-6gfg-83qx). `apos.util.set()` and `apos.util.get()` refused the `__proto__`, `constructor` and `prototype` segments, but followed every other property inherited from `Object.prototype` and `Array.prototype`. An authenticated editor could send a single PATCH REST API request with a body of `{ "toString.call": "x" }` to reach the shared `Object.prototype.toString` function and shadow its `call` method, breaking every later `Object.prototype.toString.call()` in the process, including those inside the MongoDB driver: one request took the site down until it was restarted. Both methods now traverse own properties only, which confines a dot path to the request body and the document being patched. All users should update. Thanks to Fabian Bräunlein of [Positive Security](https://positive.security/) for reporting the vulnerability.
