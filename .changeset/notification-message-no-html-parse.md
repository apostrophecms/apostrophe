---
"apostrophe": patch
---

Security: the admin UI no longer parses notification messages as HTML when deciding whether to apply the "long notification" style. Notifications have been displayed as text since 2021, but this leftover check assigned the message to `innerHTML` of a detached element, so event-handler markup in a notification could execute. Markup could only arrive via a user's own notification REST requests or via server-side notifications interpolating untrusted text; there is no known practical exploit.
