---
"apostrophe": patch
---

Fixed a 500 error when logging in on a session that had just been invalidated by a password change or by a disabled account. Such sessions are now regenerated rather than destroyed, so the request keeps a usable session and the invalidated one is removed from the store before the response is sent.
