# Collection Methods

All collection methods are accessed from a collection object:

```js
const db = client.db();
const articles = db.collection('articles');
```

## insertOne(doc)

Inserts a single document. If `_id` is not provided, a random 24-character hex string is generated. If an ObjectId is passed as `_id`, it is converted to its hex string representation. `_id` is always a string.

Throws a duplicate key error (code `11000`) if the `_id` or any unique index constraint is violated.

```js
const result = await collection.insertOne({ title: 'Hello' });
```

Returns:

```js
{
  acknowledged: true,
  insertedId: '64a1b2c3d4e5f6a7b8c9d0e1',
  insertedCount: 1,
  ops: [{ _id: '...', title: 'Hello' }],
  result: { ok: 1 }
}
```

## insertMany(docs)

Inserts an array of documents. Documents are inserted sequentially; insertion stops on the first error.

```js
const result = await collection.insertMany([
  { title: 'First' },
  { title: 'Second' }
]);
```

Returns:

```js
{
  acknowledged: true,
  insertedCount: 2,
  insertedIds: { 0: 'id1', 1: 'id2' },
  result: { ok: 1 }
}
```

`insertedIds` is a map of array index to `_id`.

## findOne(query, options)

Returns the first matching document, or `null` if no documents match.

```js
const doc = await collection.findOne({ slug: 'hello' });

// With projection
const doc = await collection.findOne(
  { slug: 'hello' },
  { projection: { title: 1, slug: 1 } }
);
```

**Options:**

- `projection` — field inclusion or exclusion specification. `{ title: 1, slug: 1 }` returns only those fields plus `_id`. `{ body: 0 }` returns everything except `body`. `_id` is always included unless explicitly excluded with `{ _id: 0 }`.

## find(query)

Returns a cursor for iterating over matching documents. Cursor methods are chainable and must be called before `toArray()`.

```js
const docs = await collection.find({ type: 'article' })
  .sort({ createdAt: -1 })
  .limit(10)
  .skip(20)
  .project({ title: 1, slug: 1 })
  .toArray();
```

### Cursor Methods

| Method | Description |
|--------|-------------|
| `.sort(spec)` | Sort order. `{ field: 1 }` for ascending, `{ field: -1 }` for descending. Multiple fields are supported. |
| `.limit(n)` | Maximum number of documents to return. `0` means no limit. |
| `.skip(n)` | Number of documents to skip before returning results. |
| `.project(spec)` | Field projection, same as the `projection` option on `findOne`. |
| `.clone()` | Returns an independent copy of the cursor. |
| `.toArray()` | Executes the query and returns all matching documents as an array. |
| `.next()` | Returns the next document, or `null` when exhausted. Also accepts a `(err, doc)` callback. |
| `.count()` | Returns the total count of matching documents. Ignores `limit` and `skip`. |
| `.addCursorFlag()` | No-op, provided for MongoDB driver compatibility. |

### Async Iteration

Cursors support `for await...of`:

```js
for await (const doc of collection.find({ type: 'article' })) {
  // process each document
}
```

## updateOne(query, update, options)

Updates the first document matching the query using [update operators](./updates.md).

```js
await collection.updateOne(
  { slug: 'hello' },
  { $set: { title: 'Updated' } }
);

// With upsert
await collection.updateOne(
  { slug: 'hello' },
  { $set: { title: 'Upserted' } },
  { upsert: true }
);
```

**Options:**

- `upsert` — if `true` and no document matches, inserts a new document. Fields from the query are merged into the new document along with the update operations.

Returns:

```js
{
  acknowledged: true,
  matchedCount: 1,      // 0 if no match (and no upsert)
  modifiedCount: 1,     // 0 if no changes made
  upsertedId: null,     // set to the new _id when upserted
  upsertedCount: 0,     // 1 when upserted
  result: { nModified: 1, n: 1 }
}
```

When upserting, `matchedCount` is `0`, `upsertedCount` is `1`, and `modifiedCount` is `0`.

## updateMany(query, update, options)

Updates all documents matching the query. Same options and return structure as `updateOne`, but counts reflect all matched documents.

```js
await collection.updateMany(
  { status: 'draft' },
  { $set: { status: 'published' } }
);
```

## replaceOne(query, replacement, options)

Replaces the entire document (except `_id`) with the given replacement object. This is not an update operation — the replacement document should not contain update operators.

Supports `upsert: true`.

```js
await collection.replaceOne(
  { slug: 'hello' },
  { slug: 'hello', title: 'Replaced', body: 'New content' }
);
```

Returns the same structure as `updateOne`.

## deleteOne(query)

Deletes the first document matching the query.

```js
const result = await collection.deleteOne({ slug: 'hello' });
```

Returns:

```js
{
  acknowledged: true,
  deletedCount: 1,  // 0 if no match
  result: { ok: 1 }
}
```

## deleteMany(query)

Deletes all documents matching the query.

```js
const result = await collection.deleteMany({ status: 'archived' });
// result.deletedCount — number of documents removed
```

## findOneAndUpdate(query, update, options)

Finds a document, updates it, and returns it. Useful for atomic read-modify-write operations.

```js
const result = await collection.findOneAndUpdate(
  { slug: 'hello' },
  { $inc: { views: 1 } },
  { returnDocument: 'after' }
);
// result.value — the document
```

**Options:**

- `returnDocument` — `'before'` (default) returns the document as it was before the update. `'after'` returns the updated document.
- `upsert` — if `true`, inserts a new document when no match is found.

## findOneAndReplace(query, replacement, options)

Like `findOneAndUpdate`, but replaces the entire document. Same options.

## countDocuments(query)

Returns the count of documents matching the query.

```js
const count = await collection.countDocuments({ type: 'article' });
```

## distinct(field, query)

Returns an array of distinct values for a field across all matching documents.

Array fields are automatically flattened — if some documents have a scalar value and others have an array, all values are collected and deduplicated.

```js
const types = await collection.distinct('type');
const tags = await collection.distinct('tags', { published: true });

// If documents are: { tags: 'a' }, { tags: ['a', 'b'] }
// Result: ['a', 'b']
```

## bulkWrite(operations)

Executes an array of write operations in sequence.

```js
await collection.bulkWrite([
  { insertOne: { document: { title: 'New' } } },
  { updateOne: { filter: { slug: 'old' }, update: { $set: { title: 'Updated' } } } },
  { updateMany: { filter: { status: 'draft' }, update: { $set: { reviewed: true } } } },
  { replaceOne: { filter: { slug: 'replace-me' }, replacement: { slug: 'replace-me', title: 'Replaced' } } },
  { deleteOne: { filter: { slug: 'gone' } } },
  { deleteMany: { filter: { status: 'archived' } } }
]);
```

Returns:

```js
{
  acknowledged: true,
  insertedCount: 1,
  modifiedCount: 2,
  deletedCount: 3,
  upsertedCount: 0,
  insertedIds: { 0: 'new-id' },
  upsertedIds: {}
}
```

## aggregate(pipeline)

Runs an aggregation pipeline. See [Aggregation](./aggregation.md) for supported stages and accumulators.

```js
const results = await collection.aggregate([
  { $match: { type: 'order' } },
  { $group: { _id: '$status', total: { $sum: '$amount' } } }
]).toArray();
```

## drop()

Drops the collection and all its data.

## rename(newName)

Renames the collection.

## Database-Level Methods

```js
const db = client.db();

// List collections
const collections = await db.listCollections().toArray();

// Create a collection explicitly
await db.createCollection('newCollection');

// Drop the entire database
await db.dropDatabase();

// Admin: list databases (in multipostgres mode, lists schemas)
const { databases } = await db.admin().listDatabases();
```
