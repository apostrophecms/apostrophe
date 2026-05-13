---
"sanitize-html": patch
"apostrophe": patch
"launder": patch
---

Security: launder now uses and exports the best available naughtyHref function for detecting malicious URLs. sanitize-html now depends on it, and apostrophe now uses type: 'url' for the link URL field of image widgets, which leverages it. Prior to this fix, it was possible for any user with editing privileges, including a contributor, to trigger arbitrary JavaScript via a javascript: URL in the link URL field of an image widget. A migration has been included to strip any such malicious URLs already present in the database. All users of apostrophe are encouraged to upgrade to get this security fix. Thanks to [Muhammad Uwais](https://github.com/MuhammadUwais) for reporting the issue.
