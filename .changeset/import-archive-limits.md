---
"@apostrophecms/import-export": patch
---

Security: extracting an import archive had no limit on the size or number of the files it wrote, so a small, highly compressed archive could fill the server's disk, and a failed import left the uploaded archive, its copy in uploadfs and its partial extraction behind. Extraction now stops as soon as the archive goes over a limit on the number of entries (100,000 by default) or on the total extracted size (100 times the size of the archive, at least 64MB, by default), counted on the bytes actually written. The limits can be changed with the new `importLimits` option of the module. Entries other than files and directories are skipped, and everything an import uploaded or extracted is removed whenever it fails. Exploiting this required a logged-in user (CWE-400, CWE-409, CWE-459, GHSA-9g7p-m758-rp72).

Thanks to [Mufeed VH](https://github.com/mufeedvh) and [Vivek R](https://github.com/123vivekr) for reporting the vulnerability.
