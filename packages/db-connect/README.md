# @apostrophecms/db-connect

`@apostrophecms/db-connect` defines the database connection API for [ApostropheCMS](https://apostrophecms.com). It provides adapters for MongoDB, PostgreSQL, and SQLite, and includes the `apos-db-dump` and `apos-db-restore` command-line utilities for database migration and backup.

The db-connect API is compatible with a large subset of the MongoDB API. However, after this introductory note, this document describes the **db-connect API** on its own terms. For projects that need to work across all three databases, it is necessary to use only the functionality defined here.

## Supported Connection URLs

### MongoDB

```
mongodb://localhost:27017/mydb
mongodb+srv://user:pass@cluster.example.com/mydb
```

Standard MongoDB connection strings. The MongoDB adapter is a thin wrapper around the existing driver.

### PostgreSQL

```
postgres://localhost:5432/mydb
```

Single-database mode. All collections are stored as tables in the `public` schema.

### SQLite

```
sqlite:///path/to/database.db
sqlite://:memory:
```

File-based or in-memory SQLite databases using `better-sqlite3`.

### Multi-Schema PostgreSQL (multipostgres)

```
multipostgres://localhost:5432/shareddb-tenant1
```

Designed for use with the ApostropheCMS [multisite](https://github.com/apostrophecms/multisite) module. In this mode, each site gets its own PostgreSQL schema within a single physical database.

The URL path is split at the **last hyphen**:

- Everything before the last hyphen is the real PostgreSQL database name (`shareddb`)
- Everything after is the schema name (`tenant1`)

Each schema is created automatically on first use and dropped cleanly when the database is dropped. This provides true multi-tenant isolation — no cross-tenant data leakage — while sharing a single PostgreSQL instance efficiently.

## Connecting

```js
const connect = require('@apostrophecms/db-connect');

const client = await connect('postgres://localhost:5432/mydb');
const db = client.db();
const articles = db.collection('articles');

// Insert a document
const result = await articles.insertOne({ title: 'Hello', status: 'draft' });

// Query documents
const docs = await articles.find({ status: 'draft' })
  .sort({ title: 1 })
  .limit(10)
  .toArray();

// Update a document
await articles.updateOne(
  { _id: result.insertedId },
  { $set: { status: 'published' } }
);

await client.close();
```

`connect(uri)` returns a client. Call `client.db()` to get a database, then `db.collection(name)` to get a collection.

## Atomicity

`insertOne` and `deleteOne` are always atomic.

`updateOne` without `upsert` is atomic when it uses only the following operators:

- **`$set`**, **`$inc`**, **`$unset`**, **`$currentDate`** — always atomic
- **`$push`**, **`$pull`**, **`$addToSet`** — atomic when all values are **scalars** (strings, numbers, booleans). Object or array values fall back to read-modify-write.

These operators can be freely combined in a single `updateOne` call and the entire update will be atomic. This covers the most common patterns: counters, status flags, timestamps, field cleanup, and adding/removing items to/from arrays.

**The following operations are NOT guaranteed to be atomic** and use a read-modify-write pattern (the document is read, the update is applied in JavaScript, and the result is written back):

- `updateOne` with **`$rename`** or **`upsert: true`**
- `updateOne` with `$push`, `$pull`, or `$addToSet` using **non-scalar** values
- **`updateMany`**, **`findOneAndUpdate`**, and **`replaceOne`**

For operations that must be atomic and aren't covered above, use advisory locking (`apos.lock`) to serialize access. Apostrophe core already uses advisory locking where atomicity matters (e.g., `apos.lock.lock` around critical sections).

## API Reference

- [Database and Client](./docs/database.md) — `client.db(name)`, listing collections, dropping databases
- [Collection Methods](./docs/collections.md) — CRUD operations, cursors, and bulk writes
- [Query Operators](./docs/queries.md) — filtering documents with comparison, logical, element, and array operators
- [Update Operators](./docs/updates.md) — modifying documents with `$set`, `$inc`, `$push`, and more
- [Indexes](./docs/indexes.md) — creating and managing indexes, including numeric and date types
- [Aggregation](./docs/aggregation.md) — pipeline stages and group accumulators
- [Dump and Restore](./docs/dump-restore.md) — CLI tools and programmatic API for backup and migration
