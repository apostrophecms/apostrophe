---
"apostrophe": patch
---

Security: a type's `viewRole` was not applied to editing, so a logged-in user below that role who met the type's `editRole` (by default, a contributor) could read, modify and delete drafts of that type through the routes that authorize on editing, such as the universal doc API, document versions and the REST write routes. A user who cannot view a type can now no longer edit, create, delete or publish its documents. Only sites with types that set `viewRole` above their `editRole` are affected (CWE-285, CWE-862, CWE-200, GHSA-9wx5-rxfg-8rpw).

Thanks to [Santh](https://github.com/santhreal) for reporting the vulnerability.
