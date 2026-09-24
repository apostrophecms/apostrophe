---
"@apostrophecms/form": patch
---

Security: the public form submission route wrote every uploaded file to the system temporary directory with no size or count limits, before checking which form it was for or whether that form accepts files at all. Anonymous visitors could use this to fill the disk. Uploaded files are now only accepted after the form has been identified, and only for that form's file fields; anything else is rejected before it reaches the disk. Multipart submissions are also limited in file size, file count and field count, configurable with the new `uploadLimits` option. The file size limit defaults to the attachment module's `maxSize` option if set, otherwise 20MB. Upload errors and aborted requests now stop the submission instead of processing it with incomplete data. The form widget's browser code now sends the form data before the files, which the server requires (CWE-400, CWE-770, GHSA-89mh-mm8c-mv7f).

Thanks to [Anisetti Chaitanya Eshwar Prasad](https://github.com/chaitanyaeshwarprasad) for responsibly reporting the vulnerability.
