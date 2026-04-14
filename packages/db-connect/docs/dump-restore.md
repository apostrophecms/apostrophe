# Dump and Restore

`@apostrophecms/db-connect` ships CLI tools and a programmatic API for exporting and importing databases in a portable JSONL format. Because the format is adapter-agnostic, you can dump from one database type and restore to another.

## CLI Tools

### Running the commands

Any ApostropheCMS project has `@apostrophecms/db-connect` installed as a transitive dependency, so the `apos-db-dump` and `apos-db-restore` binaries are present in `node_modules/.bin` of every Apostrophe project. There are three common ways to invoke them:

**Project-local with `npx` (recommended for one-off use):**

```bash
cd /path/to/your/apostrophe/project
npx apos-db-dump mongodb://localhost:27017/mydb --output=backup.jsonl
npx apos-db-restore postgres://localhost:5432/mydb --input=backup.jsonl
```

`npx` finds the binary in the project's `node_modules/.bin`, so no global installation is needed.

**Project-local via npm scripts:**

Add entries to your project's `package.json`:

```json
{
  "scripts": {
    "db:dump": "apos-db-dump",
    "db:restore": "apos-db-restore"
  }
}
```

Then run:

```bash
npm run db:dump -- mongodb://localhost:27017/mydb --output=backup.jsonl
```

**Globally installed (for operators who manage many projects):**

```bash
npm install -g @apostrophecms/db-connect
apos-db-dump mongodb://localhost:27017/mydb --output=backup.jsonl
```

A global install puts `apos-db-dump` and `apos-db-restore` directly on your `PATH`. The global copy is independent of any particular project, so use the same major version you have installed in your projects to ensure the JSONL format matches.

The examples in the rest of this document drop the `npx` prefix for readability. Prepend `npx` (or use one of the other invocation styles above) according to how you've set things up.

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

Returns an **async iterable** that yields one JSONL record per line (no trailing newlines). The dump is produced incrementally so large databases never sit fully in memory.

```js
for await (const line of dump('postgres://localhost:5432/mydb')) {
  process.stdout.write(line + '\n');
}
```

To collect the entire dump as a string (only safe for small databases):

```js
const lines = [];
for await (const line of dump(uri)) lines.push(line);
const data = lines.join('\n') + '\n';
```

Also accepts an already-connected `db` object instead of a URI string.

### restore(uri, source)

Imports a JSONL stream into the database. `source` can be any of:

- an async iterable of JSONL lines (as produced by `dump()`)
- an iterable / array of JSONL lines
- a Node Readable stream (e.g. `process.stdin`, `fs.createReadStream(...)`)
- a single JSONL string — retained for convenience, not recommended for large dumps

```js
// Async iterable
await restore('sqlite:///path/to/db.sqlite', dump(sourceUri));

// Readable stream
await restore('sqlite:///path/to/db.sqlite', fs.createReadStream('backup.jsonl'));

// String (small dumps only)
await restore('sqlite:///path/to/db.sqlite', dataString);
```

Also accepts an already-connected `db` object.

### copyDatabase(sourceUri, destUri)

Copies all data directly from one database to another by piping `dump()` straight into `restore()`. No intermediate buffer — works regardless of database size.

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

On restore, indexes are recreated from the header. Index creation failures are fatal — a failed `createIndex` is a real problem (invalid index name, conflicting definition, backend incompatibility) and should surface to the caller rather than being silently tolerated.
