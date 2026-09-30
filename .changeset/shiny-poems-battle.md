---
"apostrophe": patch
---

Fixed the orphaned document-type boot warning hardcoding "mongodb collection" — it now says "collection" so the message doesn't misreport the database on SQLite (or other non-MongoDB) projects.
