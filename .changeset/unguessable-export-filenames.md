---
"@apostrophecms/import-export": patch
---

Security: export downloads are published under the public `/uploads/exports/` URL until they expire, and their file names were built only from the site's short name, the exported type and a timestamp to the second, so anyone could guess the URL of a fresh export and download it without logging in. Export file names now include a random, unguessable id, and the type in the name is reduced to a slug so it can no longer place the file outside the exports folder. Exposure was limited: a privileged user had to have just run an export, and the download is removed after 10 minutes by default (CWE-200, CWE-330, GHSA-5gc8-frw3-3vqm).

Thanks to [tikisan_](https://github.com/tikipiya) for reporting the vulnerability.
