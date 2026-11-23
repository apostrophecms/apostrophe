---
"apostrophe": patch
---

Changing your own password, for instance via personal settings, now logs out your other sessions and invalidates your other bearer tokens. The session or bearer token used to make the change stays logged in. Previously, other logins were only invalidated when someone else changed the password, or when it was reset by email.
