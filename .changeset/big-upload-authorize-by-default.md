---
"apostrophe": patch
"@apostrophecms/import-export": patch
---

Security: `apos.http.bigUploadMiddleware()` now requires a logged-in user by default, and the `aposBigUpload` protocol it implements has been hardened (CWE-400, CWE-306, CWE-770, GHSA-86wm-68pq-5jwq).

The middleware accepted an optional `authorize` callback, but a route that did not supply one processed `start`, `chunk` and `end` requests from anyone. Since the protocol allocates server-side upload state and writes chunks to uploadfs before the route's own handler runs, any permission check made by the route was made too late. An unauthenticated request could create upload records, store chunk data and drive filesystem work on a site using such a route. Specifically:

- The middleware now refuses any request without `req.user` unless the route supplies its own `authorize` callback. Authorization runs before the request body is parsed, so an unauthorized request no longer reaches multer or leaves a temporary file behind. A route that genuinely accepts anonymous big uploads may pass `authorize: false` to opt out, and is then responsible for its own protection against abuse. Only `false` opts out: any other non-function value now throws at startup, so a misspelled or undefined variable cannot quietly leave a route open.
- The client-declared chunk count per file is now required to be a positive integer (or zero, for a zero-byte file) no greater than the new `bigUploadMaxChunks` option (default 10000, allowing a 40GB file at the client's 4MB chunk size), and the number of files may not exceed the new `bigUploadMaxFiles` option (default 10). The count drives a loop over uploadfs both when assembling a file and when cleaning it up; a declared count of `Number.MAX_SAFE_INTEGER` left cleanup running effectively forever, and because expired uploads are cleaned up at the start of every new one, one such record stalled every later upload on the site. Cleanup also bounds the chunk count and the number of files it reads back from an existing record, so a record written before this release cannot hang it.
- When assembling an upload fails partway through `end`, the temporary files already assembled for it are now removed rather than left behind.
- A failed `end` request no longer crashes the process. A request naming an upload id that does not exist sent its response and then passed `null` to the background cleanup routine, producing an unhandled rejection, which by default terminates Node. As a backstop, the middleware no longer returns a promise to Express, which ignores it; anything that rejects on the way to the route is now logged and answered with a 500.
- The upload id sent to `chunk` and `end` is now laundered to a string. As an object it reached the MongoDB selector as a query operator, so `aposBigUpload[id][$ne]=` selected an arbitrary upload in progress rather than the caller's own (CWE-943). Uploads additionally record the user that started them and are only readable by that same user.
- `start`, `chunk` and `end` now report a rejected request with its own status code (400 or 404) instead of a blanket 500, a 500 carries the underlying error and stack to the log rather than an empty event, and a refused request is logged without a stack.

In `@apostrophecms/import-export`, the `importExportImport` routes of `@apostrophecms/import-export-page` and `@apostrophecms/import-export-piece-type` now authorize the chunked upload before it is processed (CWE-400, CWE-306, GHSA-86wm-68pq-5jwq).

Both routes passed no `authorize` callback to `apos.http.bigUploadMiddleware()`, so an unauthenticated request could complete the `aposBigUpload` `start`, `chunk` and `end` steps — creating upload state, storing chunk data and assembling a temporary file — before `import()` reached its own `req.user` check and rejected the import. Each route now makes that same check up front, and unauthenticated requests are refused before any upload state exists.

The middleware in `apostrophe` itself now requires a logged-in user by default and bounds the client-declared chunk count, so this module is protected even without the explicit callback; the callback keeps the routes safe when installed alongside an older `apostrophe`.

Thanks to [Kai Zhi](https://github.com/kaizhi888) and [Bp0lr](https://github.com/bp0lr) for reporting the vulnerability, and to [Bp0lr](https://github.com/bp0lr) for contributing additional hardening.
