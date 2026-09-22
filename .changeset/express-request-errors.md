---
"apostrophe": patch
---

Errors passed to `next(err)` by Express middleware are logged as structured `request-error` events by `@apostrophecms/express` and answered with JSON for the API, the external front and any client not preferring HTML, and plain text for browser navigations, instead of Express's raw stack on stderr and its HTML error page.
