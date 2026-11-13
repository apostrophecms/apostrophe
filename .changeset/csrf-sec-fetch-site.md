---
"apostrophe": patch
"@apostrophecms/apostrophe-astro": patch
---

Security: CSRF protection relied on `SameSite=Lax` cookies, which browsers also send on requests from other origins of the same site, such as a sibling subdomain. A page on another subdomain of the same registrable domain could therefore submit unsafe requests as a logged-in user. Unsafe requests that the browser marks as coming from another origin (via the `Sec-Fetch-Site` header) are now rejected. Exploitation required the attacker to control a page on a sibling subdomain, and normal permission checks still applied. Non-browser clients, API keys, bearer tokens and `csrfExceptions` are unaffected. If a separate frontend on another origin of the same site legitimately makes unsafe requests with the user's session cookie, list its origin in the new `allowedOrigins` subproperty of the `csrf` option of `@apostrophecms/express`. Server-side `Astro.locals.aposFetch` calls in `@apostrophecms/apostrophe-astro` no longer forward the `Sec-Fetch-*` headers of the page request (CWE-352, GHSA-3fm4-523m-gcr5).

Thanks to [goku](https://github.com/Ka7arotto) for reporting the vulnerability.
