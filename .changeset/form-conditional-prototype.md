---
"@apostrophecms/form": patch
---

Security: when processing a form submission, condition names and values from the form's conditional widgets were used as keys of plain objects, so a conditional widget naming `__proto__` could modify or remove properties of `Object.prototype` for the whole server process each time the form was submitted. These keys are now stored in objects with no prototype. Uploaded file field names are counted the same way, which also fixes uploads for file fields whose names match built-in object properties such as `constructor`. Planting the conditional required a user with permission to edit forms; the submission itself could be anonymous (CWE-1321, GHSA-3fg6-2672-62jf).

Thanks to [Jace](https://github.com/manus-use) for reporting the vulnerability.
