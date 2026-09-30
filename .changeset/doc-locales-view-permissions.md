---
"apostrophe": patch
---

Security: the `:_id/locales` REST route of piece types and pages did not apply the public API check used by the other read routes, and `apos.doc.getLocales()` did not apply document-level view permissions. As a result, a caller could learn which locales exist for documents they are not allowed to view, including draft locales of document types restricted by `viewRole` for logged-in users. The route now requires the same public API access as its sibling routes, and only the locale versions of a document that the current user is permitted to view are returned (CWE-862, CWE-200, GHSA-gqh3-7856-rjjg).

Thanks to [Santosh Kumar Puppala](https://github.com/Santoshkumarpuppala) and [thota murari](https://github.com/thotamurari) for reporting the vulnerability.
