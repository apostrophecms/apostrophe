---
"@apostrophecms/form": patch
---

Security (GHSA-rgg4-476q-xgcg): file attachments are no longer stored before a form submission passes validation. Previously, when a submission was rejected — for example due to a failed reCAPTCHA challenge or a missing required field — any uploaded files had already been written as publicly accessible attachments, and those orphaned records were never reclaimed by garbage collection. Submissions are now rejected before any files are stored, and any attachments created while processing a submission that is ultimately rejected are removed. Thanks to [H3xV0rT3x](https://github.com/H3xV0rT3x) for reporting this issue.
