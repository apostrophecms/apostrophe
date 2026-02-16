# @apostrophecms/db - Universal Database Adapter

## Project Overview

A universal database adapter for ApostropheCMS that provides a MongoDB-compatible interface with pluggable backends. Currently supports MongoDB (passthrough) and PostgreSQL (full implementation).

**Design Philosophy:**
- Expose only operations actually used by ApostropheCMS (not the full MongoDB API)
- Make backends easy to write by keeping the interface minimal
- Bias toward escaping inputs rather than rejecting them (except where no safe representation exists)
- All `createIndex` calls happen at startup, so no runtime schema introspection needed

## File Structure

```
db/
├── index.js              # Main entry point, exports { mongodb, postgres }
├── adapters/
│   ├── mongodb.js        # Thin wrapper around native MongoDB driver
│   └── postgres.js       # Full PostgreSQL implementation (~1500 lines)
├── test/
│   ├── adapter.test.js   # Comprehensive test suite (106 MongoDB / 125 PostgreSQL tests)
│   └── security.test.js  # SQL injection prevention tests
├── package.json
└── CLAUDE.md
```

## Connection API

Both adapters use URI as the first argument:

```javascript
const { mongodb, postgres } = require('@apostrophecms/db');

// MongoDB
const client = await mongodb.connect('mongodb://localhost:27017/mydb');

// PostgreSQL
const client = await postgres.connect('postgres://user:pass@localhost:5432/mydb');

// Get database reference (uses URI's database if no argument)
const db = client.db();

// Or switch databases
const otherDb = client.db('other-database');

await client.close();
```

Each adapter exports `protocols` array for URI scheme matching:
- MongoDB: `['mongodb', 'mongodb+srv']`
- PostgreSQL: `['postgres', 'postgresql']`

## Supported Operations

### Collection Methods
- `insertOne`, `insertMany`
- `find` (returns cursor), `findOne`
- `updateOne`, `updateMany`, `replaceOne`
- `deleteOne`, `deleteMany`
- `countDocuments`, `distinct`
- `aggregate` (with `$match`, `$sort`, `$limit`, `$skip`, `$project`, `$unwind`)
- `bulkWrite`
- `findOneAndUpdate`
- `createIndex`, `dropIndex`, `indexes`
- `drop`, `rename`

### Query Operators
`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$and`, `$or`, `$not`, `$exists`, `$regex`, `$all`

### Update Operators
`$set`, `$unset`, `$inc`, `$push`, `$pull`, `$addToSet`, `$currentDate`

### Cursor Methods
`sort`, `limit`, `skip`, `project`, `toArray`, `count`, `clone`

## PostgreSQL Implementation Details

### Storage Model
- Documents stored as JSONB in `data` column
- `_id` extracted to TEXT primary key column
- Table names: `{dbname}_{collectionname}` (hyphens converted to underscores)

### Date Handling
Dates are serialized as `{ $date: "ISO8601 string" }` wrapper objects because:
1. JSON.stringify calls `toJSON()` on Dates before any replacer sees them
2. Need to distinguish dates from strings for proper deserialization
3. ISO 8601 strings sort correctly as text (important for indexes)

### Security Approach
- **Table/index names**: Validated against `^[a-zA-Z_][a-zA-Z0-9_]*$` (PostgreSQL limitation)
- **Field names in JSONB**: Escaped with `escapeString()` (single quotes doubled)
- **Values**: Always parameterized (`$1`, `$2`, etc.)
- **LIMIT/OFFSET**: Validated as non-negative integers

### Query Building
`buildWhereClause` and `buildOperatorClause` **mutate** the `params` array by pushing values. The returned SQL contains positional placeholders referencing array indices. This is documented in the code.

### Typed Indexes for Range Queries

PostgreSQL requires explicit typing for numeric indexes. The `type` option enables this:

```javascript
// Text index (default) - for $eq, $in, $regex
await collection.createIndex({ slug: 1 });

// Numeric index - for $gt/$lt on numbers
await collection.createIndex({ price: 1 }, { type: 'number' });
// Creates: ((data->>'price')::numeric)

// Date index - for $gt/$lt on dates
await collection.createIndex({ createdAt: 1 }, { type: 'date' });
// Creates: (data->'createdAt'->>'$date') - text, since ISO sorts correctly
```

Without `type`, range queries won't use the index (they still work, just slower).

### Sparse Indexes
Implemented via PostgreSQL partial indexes:
```javascript
await collection.createIndex({ field: 1 }, { sparse: true });
// Creates: ... WHERE data->'field' IS NOT NULL
```

## Testing

```bash
# Run all tests with MongoDB
npm run test:mongodb

# Run all tests with PostgreSQL
npm run test:postgres

# Run both
npm test
```

**Test Prerequisites:**
- MongoDB running on localhost:27017
- PostgreSQL running on localhost:5432 with database `dbtest_adapter`
- Set `PGUSER`/`PGPASSWORD` env vars if needed

## Known Limitations / Future Work

1. **Aggregation**: Only basic stages implemented (`$match`, `$sort`, `$limit`, `$skip`, `$project`, `$unwind`)
2. **Text search**: Basic GIN index support, not full MongoDB text search semantics
3. **Transactions**: No (not an ApostropheCMS requirement)
4. **Change streams**: No (not an ApostropheCMS requirement)

## Common Gotchas

1. **Date comparisons**: Dates are stored as `{$date: "..."}` wrapper, so raw JSONB queries won't work - use the adapter's query interface

2. **Nested field paths**: Use dot notation (`user.profile.name`) - works in queries, updates, indexes, and projections

3. **Index type matters**: If you're doing `{ price: { $gt: 100 } }` queries, you need `{ type: 'number' }` on the index for PostgreSQL to use it

4. **Database switching**: In PostgreSQL, different "databases" are actually table prefixes in the same PostgreSQL database. This is intentional for simpler connection management.

5. **Collection name validation**: Hyphens are converted to underscores internally. Names with special characters beyond that will be rejected.
