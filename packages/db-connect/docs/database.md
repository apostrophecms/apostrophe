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

**PostgreSQL (single mode, `postgres://`):** The name is stored for identification, but all databases share the same tables in the `public` schema. Calling `db('other')` does *not* create a separate set of tables — it is the same data as `db()`.

**PostgreSQL (multi-schema mode, `multipostgres://`):** Each name maps to a separate PostgreSQL schema within the same physical database. `db('tenant1')` and `db('tenant2')` have fully isolated tables. Schemas are created automatically on first use.

**SQLite:** Each name opens a separate `.db` file in the same directory as the original database file. `db('other')` opens `other.db` alongside the original file. This provides true separation — each named database has its own tables and data.

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
- **SQLite:** Deletes the database file.

```js
await db.dropDatabase();
```

### db.admin().listDatabases()

Returns a list of databases. In `multipostgres` mode, this lists schemas.

```js
const { databases } = await db.admin().listDatabases();
// [{ name: 'tenant1' }, { name: 'tenant2' }, ...]
```
