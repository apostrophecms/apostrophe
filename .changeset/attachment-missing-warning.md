---
"apostrophe": patch
---

Saving a document no longer erases an attachment field's reference when the attachment's record is missing from the database (for example, after the documents were copied to a new database without `aposAttachments`). If the field already pointed at that attachment, the stored value is kept and an `attachment-not-found` warning is logged once per attachment, with the attachment id, the field path and, where there is one, the document id. A field newly pointed at a missing attachment is still cleared, now with the same warning. Fixes #4713.
