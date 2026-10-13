---
"apostrophe": patch
---

Security: the page REST API now removes fields restricted by `viewPermission` from every page it returns to a logged-in user who lacks that permission, including the home page response, `autocomplete` results, and the related pages embedded in responses (`_ancestors` and `_children`). The reported problems with `GET /api/v1/@apostrophecms/page/:_id`, which in 4.32.2 and earlier ignored type-level `viewRole` and did not remove `viewPermission` fields, were already corrected in 4.33.0 and are now covered by additional tests. Enforcing `viewRole` on that route was always the intended behavior, and the earlier behavior was a bug that should not have been relied upon. Exploiting the original issue required a logged-in account with editing access and knowledge of the page's `_id` (CWE-200, CWE-863, GHSA-vh56-5m88-39rq).

Thanks to [harshavardhan98899-lab](https://github.com/harshavardhan98899-lab) for reporting the vulnerability.
