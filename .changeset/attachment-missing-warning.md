---
"apostrophe": patch
---

Saving a document whose attachment field points at an attachment record that is missing from the database (for example, after the documents were copied to a new database without `aposAttachments`) now fails with an `invalid` error naming the attachment, instead of silently erasing the reference. Also fixes a missing `return` after the no-`_id` branch in the attachment field type's `convert()`. Fixes #4713.
