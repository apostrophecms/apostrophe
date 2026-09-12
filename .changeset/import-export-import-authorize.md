---
"@apostrophecms/import-export": patch
---

Security: the `importExportImport` routes of `@apostrophecms/import-export-page` and `@apostrophecms/import-export-piece-type` now authorize the chunked upload before it is processed (CWE-400, CWE-306, GHSA-86wm-68pq-5jwq).

Both routes passed no `authorize` callback to `apos.http.bigUploadMiddleware()`, so an unauthenticated request could complete the `aposBigUpload` `start`, `chunk` and `end` steps — creating upload state, storing chunk data and assembling a temporary file — before `import()` reached its own `req.user` check and rejected the import. Each route now makes that same check up front, and unauthenticated requests are refused before any upload state exists.

The middleware in `apostrophe` itself now requires a logged-in user by default and bounds the client-declared chunk count, so this module is protected even without the explicit callback; the callback keeps the routes safe when installed alongside an older `apostrophe`.

Thanks to [Kai Zhi](https://github.com/kaizhi888) and [bp0lr](https://github.com/bp0lr) for responsibly reporting the vulnerability.
