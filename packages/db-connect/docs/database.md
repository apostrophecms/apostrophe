# Database and Client Methods

## Client

`connect(uri)` returns a client object. The client manages the connection pool and provides access to databases.

```js
const connect = require('@apostrophecms/db-connect');

const client = await connect('postgres://localhost:5432/mydb');
const db = client.db();
// ...
await client.close();
```

### client.db(name)

Returns a database object. When called without a name, returns the default database derived from the connection URI.

When called with a name, the behavior depends on the adapter:

**MongoDB:** Behaves as in the native driver — each name accesses a separate MongoDB database on the same server.

**PostgreSQL (single mode, `postgres://`):** `db()` or `db('mydb')` (matching the database name from the connection URI) both return the default database. Passing a different name throws an error — there is no schema isolation in single mode.

**PostgreSQL (multi-schema mode, `multipostgres://`):** Each name must be a full virtual database name in the form `realdb-schema`, where `realdb` matches the physical database name from the connection URI. The schema name is everything after the **last** hyphen — this accommodates database names that themselves contain hyphens (e.g., `my-shared-db-tenant1` uses real database `my-shared-db` and schema `tenant1`). For example, if the URI is `multipostgres://localhost:5432/shareddb-tenant1`, then `db('shareddb-tenant2')` accesses the `tenant2` schema. Names that don't start with `realdb-` are rejected. Schemas are created automatically on first use.

**SQLite:** Each name opens a separate file in the same directory as the original database file, using the same extension. For example, if the original URI points to `data/myapp.sqlite`, then `db('other')` opens `data/other.sqlite`. This provides true separation — each named database has its own tables and data.

### client.close()

Closes the connection pool. After calling `close()`, no further database operations should be attempted.

## Database

### db.collection(name)

Returns a collection object. The collection is created automatically on first use (no need to call `createCollection` first). See [Collection Methods](./collections.md) for all available operations.

```js
const articles = db.collection('articles');
```

### db.listCollections()

Returns a cursor-like object with a `toArray()` method that lists all collections in the database.

```js
const collections = await db.listCollections().toArray();
// [{ name: 'articles' }, { name: 'users' }, ...]
```

### db.createCollection(name)

Creates a collection explicitly. In practice this is rarely needed, since collections are created automatically when first accessed.

```js
await db.createCollection('newCollection');
```

### db.dropDatabase()

Drops the entire database:

- **MongoDB:** Drops the database.
- **PostgreSQL (single mode):** Drops all collection tables.
- **PostgreSQL (multi-schema mode):** Drops the schema and all its tables.
- **SQLite:** Drops all tables and indexes, but does not delete the database file.

```js
await db.dropDatabase();
```

### db.admin().listDatabases()

Returns a list of databases. In `multipostgres` mode, this lists schemas as full virtual database names.

```js
const { databases } = await db.admin().listDatabases();
// MongoDB: [{ name: 'mydb' }, { name: 'otherdb' }, ...]
// multipostgres: [{ name: 'shareddb-tenant1' }, { name: 'shareddb-tenant2' }, ...]
```
