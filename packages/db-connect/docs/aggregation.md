# Aggregation

The `aggregate` method runs a pipeline of stages that transform and summarize documents. It returns a cursor with a `toArray()` method.

```js
const results = await collection.aggregate([
  { $match: { type: 'order' } },
  { $group: {
    _id: '$status',
    total: { $sum: '$amount' },
    count: { $sum: 1 }
  }},
  { $sort: { total: -1 } }
]).toArray();
```

All stages are processed in memory after loading matching documents. For large datasets, use `$match` early in the pipeline to reduce the working set.

## Stages

### $match

Filters documents using standard [query operators](./queries.md). Place `$match` as early as possible to reduce the number of documents processed by later stages.

```js
{ $match: { status: 'active', price: { $gt: 10 } } }
```

### $group

Groups documents by a key and computes aggregate values. The `_id` field specifies the grouping expression — use a field path (prefixed with `$`) or `null` to group all documents together.

```js
{ $group: {
  _id: '$category',
  totalRevenue: { $sum: '$price' },
  averagePrice: { $avg: '$price' },
  count: { $sum: 1 }
}}
```

#### Accumulators

| Accumulator | Description |
|-------------|-------------|
| `$sum` | Sums numeric values. Use `{ $sum: 1 }` to count documents in each group. Use `{ $sum: '$fieldName' }` to sum a field's values. |
| `$avg` | Computes the arithmetic mean of numeric values. |
| `$first` | Returns the value from the *first* document in each group. Order depends on preceding `$sort` stages. |
| `$last` | Returns the value from the *last* document in each group. |

> **Not supported:** `$min`, `$max`, `$push`, `$addToSet`.

### $project

Reshapes documents by including or excluding fields. Uses the same projection syntax as [`find().project()`](./collections.md).

```js
{ $project: { name: 1, email: 1, _id: 0 } }
```

### $unwind

Deconstructs an array field, outputting one document per array element. Each output document replaces the array with a single element.

```js
{ $unwind: '$tags' }

// Object form also supported:
{ $unwind: { path: '$tags' } }
```

Given `{ title: 'Post', tags: ['a', 'b'] }`, `$unwind` produces:

```js
{ title: 'Post', tags: 'a' }
{ title: 'Post', tags: 'b' }
```

### $sort

Sorts documents. `1` for ascending, `-1` for descending.

```js
{ $sort: { createdAt: -1 } }
{ $sort: { category: 1, price: -1 } }
```

### $limit

Limits the number of documents passed to the next stage.

```js
{ $limit: 10 }
```

### $skip

Skips the specified number of documents.

```js
{ $skip: 20 }
```

## Example: Top Categories by Revenue

```js
const topCategories = await orders.aggregate([
  { $match: { status: 'completed' } },
  { $group: {
    _id: '$category',
    revenue: { $sum: '$total' },
    orders: { $sum: 1 },
    avgOrder: { $avg: '$total' }
  }},
  { $sort: { revenue: -1 } },
  { $limit: 5 }
]).toArray();
```
