# Dump and Restore

`@apostrophecms/db-connect` ships CLI tools and a programmatic API for exporting and importing databases in a portable JSONL format. Because the format is adapter-agnostic, you can dump from one database type and restore to another.

## CLI Tools

### apos-db-dump

```bash
# Dump to a file
apos-db-dump postgres://localhost:5432/mydb --output=backup.jsonl

# Dump to stdout
apos-db-dump sqlite:///path/to/db.sqlite
```

### apos-db-restore

```bash
# Restore from a file
apos-db-restore postgres://localhost:5432/mydb --input=backup.jsonl

# Restore from stdin
cat backup.jsonl | apos-db-restore sqlite:///path/to/newdb.sqlite
```

### Cross-Database Migration

Pipe `dump` output directly into `restore` to migrate between backends:

```bash
# MongoDB to PostgreSQL
apos-db-dump mongodb://localhost:27017/mydb | apos-db-restore postgres://localhost:5432/mydb

# PostgreSQL to SQLite
apos-db-dump postgres://localhost:5432/mydb | apos-db-restore sqlite:///path/to/local.db
```

### multipostgres URIs

`multipostgres://` URIs are fully supported. The URI path is a complete virtual database name, split at the **last hyphen** into a real PostgreSQL database name and a schema name. This lets you dump or restore a single tenant's schema directly from the command line:

```bash
# Dump just the tenant1 schema from the shareddb database
apos-db-dump multipostgres://localhost:5432/shareddb-tenant1 --output=tenant1.jsonl

# Restore into a different tenant's schema
apos-db-restore multipostgres://localhost:5432/shareddb-tenant2 --input=tenant1.jsonl
```

The last-hyphen rule accommodates real database names that themselves contain hyphens — `multipostgres://localhost:5432/my-shared-db-tenant1` connects to the `my-shared-db` database and operates on the `tenant1` schema. A multipostgres URI with no hyphen in the path is rejected, since it cannot specify a complete virtual database.

You can migrate between a single-database `postgres://` URI and a tenant schema by mixing protocols on either side of the pipe:

```bash
# Copy a standalone database into a tenant schema
apos-db-dump postgres://localhost:5432/mydb | apos-db-restore multipostgres://localhost:5432/shareddb-tenant1

# Extract a tenant schema into its own standalone database
apos-db-dump multipostgres://localhost:5432/shareddb-tenant1 | apos-db-restore postgres://localhost:5432/tenant1db
```

## Programmatic API

```js
const { dump, restore, copyDatabase } = require('@apostrophecms/db-connect');
```

### dump(uri)

Exports the entire database as a JSONL string.

```js
const data = await dump('postgres://localhost:5432/mydb');
```

Also accepts an already-connected `db` object instead of a URI string.

### restore(uri, data)

Imports a JSONL string into the database.

```js
await restore('sqlite:///path/to/db.sqlite', data);
```

Also accepts an already-connected `db` object.

### copyDatabase(sourceUri, destUri)

Copies all data directly from one database to another.

```js
await copyDatabase(
  'postgres://localhost:5432/source',
  'sqlite:///path/to/dest.db'
);
```

## JSONL Format

The dump format is JSONL (one JSON object per line). Each collection begins with a header line containing the collection name and index definitions, followed by one line per document.

```
{"collection":"articles","indexes":[{"key":{"slug":1},"unique":true}]}
{"_id":"abc123","title":"Hello","slug":"hello"}
{"_id":"def456","title":"World","slug":"world"}
{"collection":"users","indexes":[]}
{"_id":"user1","email":"alice@example.com"}
```

On restore, indexes are recreated from the header. Index creation failures are non-fatal, as applications typically recreate their indexes on startup.
