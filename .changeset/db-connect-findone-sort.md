---
"@apostrophecms/db-connect": patch
---

On PostgreSQL and SQLite, `find()` and `findOne()` now accept `projection`, `sort`, `limit` and `skip` as options, as they always did on MongoDB. Previously only `projection` was honored and the rest were silently ignored, so for instance `findOne(query, { sort })` returned whichever match the database found first. Among other things, this made AI localization compare against the oldest localization of a document instead of the newest on those databases, so it brought over changes that had already been localized. `findOne()` is now simply `find()` limited to one result.
