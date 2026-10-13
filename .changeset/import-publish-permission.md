---
"@apostrophecms/import-export": patch
---

Security: importing could write the published version of documents the importing user was not allowed to publish. A contributor could create or replace published content by supplying a document whose `_id` named the published mode while its `aposMode` claimed to be a draft, and an editor could import or update published documents of a type whose `publishRole` is `admin`. Import now refuses documents whose mode, locale and `_id` disagree, and requires the publish permission for every published document it writes (the edit permission still suffices for autopublished types). Drafts are still imported, and each published document that is skipped is reported as a failure in the import results. Exploiting this required a logged-in user allowed to import the type (CWE-285, CWE-863, GHSA-5m22-7pfq-vp65).

Thanks to [Mufeed VH](https://github.com/mufeedvh) and [Vivek R](https://github.com/123vivekr) for reporting the vulnerability.
