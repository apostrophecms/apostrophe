---
"@apostrophecms/apostrophe-astro": minor
---

Upgraded the `undici` HTTP client from v6 to v8, which requires Node.js 22.19 or newer, and fixed a connection leak in the Astro proxy where responses that are not streamed on to the browser — redirects (301/302/307/308) and bodyless responses (204/304) — now release their backend response body immediately instead of leaving it for garbage collection, which under load could hold connections open and exhaust the connection pool.
