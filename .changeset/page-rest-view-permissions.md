---
"apostrophe": patch
---

Security: the page REST API now enforces view permissions when fetching a single page, when fetching the full page tree (`all=1`) and when autocompleting page titles. Previously these requests skipped view permission checks, so users could read pages they were not allowed to view: with a `publicApiProjection` configured, anonymous visitors could see the projected fields of `loginRequired` pages, and logged-in contributors and editors could read pages whose type has a `viewRole` above their role. The page tree still includes pages the user can view but not edit. Fields restricted with `viewPermission` are now also removed from single-page responses, as they already are for pieces. In addition, a `viewRole` set on a page or piece type now applies to anonymous site visitors too, as was always intended; before this change it only restricted logged-in users, a bug that should not have been relied upon (CWE-285, CWE-862, GHSA-2j32-q6rx-h844).

Thanks to [Anisetti Chaitanya Eshwar Prasad](https://github.com/chaitanyaeshwarprasad) for reporting the vulnerability.
