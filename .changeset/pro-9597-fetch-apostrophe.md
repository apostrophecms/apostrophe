---
"apostrophe": minor
---

The server-side HTTP client (`apos.http`) now uses Node's built-in `fetch` instead of `node-fetch`.

`node-fetch` is no longer maintained, and Node's built-in `fetch` is its standard, actively maintained successor, available in every Node.js version Apostrophe supports - so this is the right time to adopt it. We do not consider this a breaking change: common `apos.http.*` usage is unchanged, and we deliberately preserved compatibility where it mattered - `form-data` request bodies, cookie jars, the `timeout` option (now backed by an `AbortSignal`), and absolute redirect `Location` headers all behave as before.

Most code that calls `apos.http.get()`, `apos.http.post()`, etc. needs no changes. A few things to be aware of if you use advanced options or read raw responses:

- The `agent` option is no longer supported (the built-in `fetch` has no equivalent). Pass an undici `dispatcher` instead; `apos.http` throws if `agent` is given.
- A `Host` request header can no longer be set (it is disallowed by the fetch standard and is silently ignored).
- `originalResponse: true` now resolves with the built-in `fetch` `Response`. Its `body` is a web `ReadableStream` (use `require('node:stream').Readable.fromWeb()` to read it as a Node stream), and node-fetch-only helpers such as `.buffer()` are no longer available.
- Requests that send a conditional header (`If-None-Match` / `If-Modified-Since`) now also send `Cache-Control: no-cache`, as required by the fetch standard. An endpoint that returns `304 Not Modified` based on those headers may return `200` to such a request.

New capabilities:

- The `timeout` option (in milliseconds) and the standard `signal` (`AbortSignal`) and undici `dispatcher` options are supported.
- A request `body` may be a native `FormData`, in addition to a `form-data` package instance.
