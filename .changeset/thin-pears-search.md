---
"apostrophe": minor
"@apostrophecms/seo": patch
---

Fix an XSS vulnerability allowing arbitrary markup to be inserted via the "SEO Title" or "Meta Description" fields provided by the @apostrophecms/seo module. The fix requires upgrading BOTH apostrophe and @apostrophecms/seo. A new mechanism for safely emitting JSON nodes has been introduced to make this type of vulnerability unlikely in the future. Thanks to [K Shanmukha Srinivasulu Royal](https://github.com/Chittu13) for reporting the vulnerability.
