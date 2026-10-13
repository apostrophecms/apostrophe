---
"@apostrophecms/import-export": patch
---

Security: export downloads are published under the public `/uploads/exports/` URL until they expire, and their file names were built only from the site's short name, the exported type and a timestamp to the second, so anyone could guess the URL of a fresh export and download it without logging in. Export file names now include a random 128-bit component, and the type in the name is reduced to a slug so it can no longer place the file outside the exports folder. Likewise, while an import was pending (for instance waiting for the user to confirm how to handle duplicates or a different locale), the uploaded archive, which can be a whole site export, was kept in uploadfs at a public `/uploads/import-export/` URL. It is now stored encrypted there, with a per-import key kept only in the database, so that another process can still resume the import but the public copy is unreadable. Exposure was limited: a privileged user had to have just run an export, the download is removed after 10 minutes by default, a pending import archive's URL contained a random id known only to the uploader and only existed until the import ended, and sites serving uploads from private storage were not affected (CWE-200, CWE-330, GHSA-5gc8-frw3-3vqm).

Thanks to [tikisan_](https://github.com/tikipiya) for reporting the vulnerability.
