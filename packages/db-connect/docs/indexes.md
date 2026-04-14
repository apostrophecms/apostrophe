# Indexes

Indexes improve query performance and enforce uniqueness constraints.

## createIndex(keys, options)

Creates an index on one or more fields. Returns the index name as a string.

```js
await collection.createIndex({ slug: 1 });
```

Field values in the `keys` object:

- `1` — ascending index
- `-1` — descending index
- `'text'` — full-text search index

### Options

| Option | Description |
|--------|-------------|
| `name` | Custom index name. If omitted, a name is generated from the field names (e.g., `slug_1`). |
| `unique` | If `true`, enforces a uniqueness constraint. Inserting a duplicate value throws a duplicate key error (code `11000`). |
| `sparse` | If `true`, only indexes documents where the indexed field exists. Documents without the field are omitted from the index. |
| `type` | Index value type: `'number'`, `'date'`, or omitted for the default text-based index. See below. |

### Compound Indexes

Pass multiple fields to create a compound index:

```js
await collection.createIndex({ type: 1, createdAt: -1 });
await collection.createIndex({ email: 1, tenant: 1 }, { unique: true });
```

## Index Types

By default, indexed values are extracted from the JSON document as text. This works correctly for equality checks (`$eq`, `$in`) and pattern matching (`$regex`), but **not** for range comparisons on numbers or dates, because text comparison produces incorrect ordering (e.g., `"9"` sorts after `"10"`).

### Numeric Indexes

Use `type: 'number'` when the field contains numeric values and you need range queries:

```js
await collection.createIndex({ price: 1 }, { type: 'number' });

// Now these queries use the index correctly:
await collection.find({ price: { $gt: 10, $lte: 100 } }).toArray();
```

Without the `number` type, the comparison is text-based and `{ $gt: 9 }` would not match `10`.

### Date Indexes

Use `type: 'date'` for fields that store dates. Dates are stored internally as `{ $date: "ISO-8601-string" }`, and the date index type extracts the ISO string for correct lexicographic ordering.

```js
await collection.createIndex({ createdAt: 1 }, { type: 'date' });

await collection.find({ createdAt: { $gt: new Date('2024-01-01') } }).toArray();
```

ISO-8601 strings sort correctly in chronological order because they are fixed-width and most-significant-digit-first.

### Text Indexes

Use `'text'` as the field value (not as an option) to create a full-text search index:

```js
await collection.createIndex({ title: 'text', body: 'text' });

await collection.find({ $text: { $search: 'tutorial' } }).toArray();
```

In PostgreSQL, this creates a GIN index using `to_tsvector`. In SQLite, this creates an FTS5 virtual table kept in sync with the collection, providing proper tokenized full-text search with BM25 relevance scoring.

### Combined Options

Index types can be combined with other options:

```js
await collection.createIndex(
  { publishedAt: 1 },
  { type: 'date', unique: true, sparse: true }
);
```

## Array Fields

When a query matches a scalar value against an array field, the adapters handle this transparently. For example, `{ tags: 'news' }` matches a document where `tags` is `['news', 'featured']`. This works with all query operators including `$in`, `$all`, and comparison operators.

Indexes on array fields work with this behavior — scalar lookups against array elements use the index.

## dropIndex(name)

Drops an index by name.

```js
await collection.dropIndex('slug_1');
```

## indexes()

Returns an array of index metadata for the collection.

```js
const idxs = await collection.indexes();
// [
//   { name: '_id_', key: { _id: 1 }, unique: true },
//   { name: 'slug_1', key: { slug: 1 } },
//   { name: 'price_1', key: { price: 1 }, type: 'number' }
// ]
```
