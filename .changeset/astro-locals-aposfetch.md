---
"@apostrophecms/apostrophe-astro": minor
---

Adds `Astro.locals.aposFetch`, a fetch scoped to the current request for calling Apostrophe's APIs from any component, including widgets. It forwards the request's `host` and cookies the same way page requests do, so it reaches the current site in a multisite project and respects the logged-in user's permissions. `createAposFetch(request)` creates one for a given request. The `aposFetch` helper is unchanged, and the README no longer calls it "authenticated".
