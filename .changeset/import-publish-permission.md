---
"@apostrophecms/import-export": patch
"apostrophe": patch
---

Security: importing could write the published version of documents the importing user was not allowed to publish. A contributor could create or replace published content with a crafted archive, and an editor could import or update published documents of a type whose `publishRole` is `admin`. Import now refuses documents whose mode, locale and `_id` disagree. Exploiting this required a logged-in user allowed to import the type.

The rest was a gap in the core permission check, fixed there, which also covers import. A type's `publishRole` was always meant to govern its published content, but editing or creating the published version of a document did not honor it: an editor could change published documents of a type whose `publishRole` is `admin`, including through the REST API, without publishing them through the normal workflow. That was a bug and should not have been relied upon. Editing or creating a published document now requires the `publishRole`. Types with `autopublish: true`, types without a draft/published distinction, and permission checks made with a type name rather than a document are unchanged (CWE-285, CWE-863, GHSA-5m22-7pfq-vp65).

Thanks to [Mufeed VH](https://github.com/mufeedvh) and [Vivek R](https://github.com/123vivekr) for reporting the vulnerability.
