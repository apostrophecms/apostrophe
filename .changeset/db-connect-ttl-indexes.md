---
"@apostrophecms/db-connect": minor
---

Adds support for TTL indexes (`expireAfterSeconds`) to the PostgreSQL and SQLite adapters. As in MongoDB, a background task removes expired documents every 60 seconds.
