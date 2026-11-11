---
"@apostrophecms/import-export": patch
---

Security: for types that are not localized (`localized: false`), import did not check that an archive document's `_id` matched its `aposDocId`. The duplicate shown to the user for confirmation is found by `aposDocId` while the document actually overwritten is found by `_id`, so confirming the replacement of one document could overwrite a different document of the same type. Such documents are now refused, as they already were for localized types. The overwrite was still subject to the importing user's permission to edit the document actually overwritten, so the main risk was importing an untrusted archive (CWE-20, CWE-639, GHSA-44gw-rrq5-fm92).

Thanks to [nokddubal](https://github.com/nokddubal) for reporting the vulnerability.
