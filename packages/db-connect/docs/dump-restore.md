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
