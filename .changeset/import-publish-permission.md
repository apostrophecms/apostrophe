---
"@apostrophecms/import-export": patch
"apostrophe": patch
---

Security: importing could write the published version of documents the importing user was not allowed to publish. A contributor could create or replace published content with a crafted archive, and an editor could import or update published documents of a type whose `publishRole` is `admin`. Import now refuses documents whose mode, locale and `_id` disagree, and requires the publish permission for every published document it writes (the edit permission still suffices for autopublished types). Drafts are still imported, and each published document that is skipped is reported as a failure in the import results. Exploiting this required a logged-in user allowed to import the type.

The core permission checks had the same gaps, and are fixed too. A type's `publishRole` was always meant to govern its published content, but editing or creating the published version of a document did not honor it: an editor could change published documents of a type whose `publishRole` is `admin` without publishing them through the normal workflow. That was a bug and should not have been relied upon. Editing or creating a published document now requires the `publishRole` (types with `autopublish: true` are unchanged, and so are types without a draft/published distinction, and permission checks made with a type name rather than a document). Also, `apos.permission.can()` applied the rules for the mode of the request rather than the mode of the document being checked, so `apos.doc.update()` or `apos.doc.insert()` called by custom code with a draft-mode request could write a published document with only the permissions needed for a draft. A document's own mode now decides which rules apply. The REST APIs were not affected by the second issue (CWE-285, CWE-863, GHSA-5m22-7pfq-vp65).

Thanks to [Mufeed VH](https://github.com/mufeedvh) and [Vivek R](https://github.com/123vivekr) for reporting the vulnerability.
