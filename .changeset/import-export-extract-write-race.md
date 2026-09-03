---
"@apostrophecms/import-export": patch
---

Fixed race conditions occasionally seen during import.

An expired export download that has already been removed is no longer reported as an error.
