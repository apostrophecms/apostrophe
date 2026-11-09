---
"apostrophe": patch
---

Security: the `dynamicChoices` parameter of the piece type REST API ran the choices method of any requested manager filter without the checks that the `choices` and `counts` query builders apply, so the public API (for piece types with a `publicApiProjection`) and logged-in users lacking a field's `viewPermission` could receive those filter choices. `dynamicChoices`, which exists for the piece manager, is now ignored for public API requests restricted by `publicApiProjection`, and filters on fields the user may not view are skipped. Only piece types with manager filters whose `choices` is a method are affected (CWE-862, CWE-200, GHSA-x77x-88mc-36vg).

Thanks to [Srikanth . T](https://github.com/Srikanth786369) for reporting the vulnerability.
