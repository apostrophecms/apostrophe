---
"apostrophe": patch
---

Redirects reported to an external front end are now sent with an HTTP status of 200, fixing a 500 error in Astro when a soft redirect was followed.

Apostrophe cannot issue a redirect itself when an external front end holds the browser's connection, so `@apostrophecms/express` replaces `res.redirect` with one that describes the redirect as JSON (`{ redirect: true, url, status }`) for the front end to act on. That response carries no `Location` header, because the external front end is not the party being redirected. It was, however, inheriting whatever status the request had already set, and `@apostrophecms/soft-redirect` sets `req.statusCode` to 302 before the redirect is emitted. The result was a 302 with a body and no `Location` — which `@apostrophecms/apostrophe-astro` reasonably treated as bodiless, discarding the very payload it needed and failing with `Unexpected end of JSON input`.

Visiting a page at a slug it used to live at therefore produced a 500 rather than a redirect. Redirects created with `@apostrophecms/redirect` were unaffected, as those are emitted from middleware that never sets a status first.
