---
"apostrophe": patch
---

Security: the `exist-in-locale` route of the `@apostrophecms/i18n` module only checked that the user was logged in. It then reported which of the requested documents existed in a given locale and mode, without checking whether the user was allowed to view them. A low-privilege user could therefore learn whether restricted documents, including drafts, existed in a given locale. The route now reports only documents the user is permitted to view. It rejects draft mode for users who cannot view drafts, and it rejects modes other than `draft` and `published` (CWE-862, CWE-200, GHSA-vmxh-77cw-65j7).

Thanks to [thota murari](https://github.com/thotamurari) for reporting the vulnerability.
