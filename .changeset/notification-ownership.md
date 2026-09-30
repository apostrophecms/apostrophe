---
"apostrophe": patch
---

Security: the notification REST API's `PATCH` and `DELETE` routes and the `clear-event` route did not check who was asking, so anyone who knew a notification's `_id` could dismiss it, delete it or clear its event, even without logging in. These routes, the single-notification `GET` route and the server-side `dismiss` method now require a logged-in user and act only on that user's own notifications. A notification belonging to someone else is left alone, the same way a notification that no longer exists is (CWE-862, CWE-639, GHSA-vwwx-px9w-crrc). The practical risk was low: notification ids are randomly generated and are only ever sent to the notification's own recipient, and there is no known way for anyone else to obtain one.

Thanks to [K Shanmukha Srinivasulu Royal](https://github.com/Chittu13) for reporting the vulnerability.
