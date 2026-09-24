---
"apostrophe": patch
---

Security: the rich text widget's CSV-to-table upload route accepted uploads from anyone, including logged-out visitors, and never removed the temporary file it staged on disk, whether the upload was rejected or accepted. Repeated requests could fill the system temporary directory. The route now requires the same permission as uploading attachments (checked before anything is written to disk), limits uploads to a single file of at most `csvTableMaxSize` bytes (a new rich text widget option, 10MB by default), and always removes the temporary file when the request completes (CWE-459, CWE-400, CWE-862, GHSA-qhcq-9pm2-c9w9).

Thanks to [Bp0lr](https://github.com/bp0lr) for responsibly reporting the vulnerability.
