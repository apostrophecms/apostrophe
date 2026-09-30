---
"apostrophe": patch
---

Security: confirming the current password in `@apostrophecms/settings` subforms, including the password change form (`PATCH /api/v1/@apostrophecms/settings/password`), was not throttled, so someone holding an authenticated session but not the password could guess it without limit and then replace it. These confirmations are now throttled according to the `throttle` options of the `@apostrophecms/login` module, just like logging in. Attempts are counted per user in a separate namespace, so mistakes in the settings dialog never lock the user out of the login form, and simultaneous guesses are held to the same limit as sequential ones (CWE-307, GHSA-653j-g8j7-gh54).

Thanks to [thota murari](https://github.com/thotamurari) for reporting the vulnerability.
