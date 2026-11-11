---
"@apostrophecms/import-export": patch
---

When a document can't be imported because a field is invalid, such as an attachment whose record does not exist on this site (CSV and Excel exports can't carry files), the import report now says which field failed and why, instead of an empty message.
