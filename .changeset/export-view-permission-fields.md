---
"@apostrophecms/import-export": patch
---

Security: exports included the fields the exporting user may not view (`viewPermission`), in the exported documents and in the related documents exported with them, whatever the format (including the xlsx format of `@apostrophecms/import-export-xlsx`), along with the files of such attachment fields. REST API responses already omitted these fields. Export now removes them before writing the file, the same way. Exporting requires permission to edit the exported documents and to view the related ones, and only affects sites that use `viewPermission` (CWE-200, CWE-862, GHSA-p3m7-jjv4-357v).

Thanks to [Santh](https://github.com/santhreal) for reporting the vulnerability.
