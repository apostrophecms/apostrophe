---
"@apostrophecms/import-export": patch
---

Security: when continuing an import after the user confirmed which duplicates to replace, the server trusted the list of documents and replacement targets sent back by the browser, and checked the importable type against the imported file rather than against the existing document being overwritten. A logged-in user allowed to import could overwrite documents the import never offered to replace, including documents of types they may not import, and continue the import of another user. The duplicates found by the import are now remembered on the server for the user who started it, the browser can only narrow that list down, and the type of every replaced document must be importable (CWE-639, CWE-863, GHSA-jf5h-36mg-rp6x).

Thanks to [Mufeed VH](https://github.com/mufeedvh) and [Vivek R](https://github.com/123vivekr) for reporting the vulnerability.
