# Query Operators

Queries filter documents by matching field values against conditions. A query is a plain object where each key is a field name (or a logical operator) and each value is a match condition.

```js
// Implicit $eq — matches documents where status is 'active'
{ status: 'active' }

// Explicit operator
{ age: { $gte: 18 } }

// Multiple fields — all must match (implicit $and)
{ status: 'active', type: 'article' }
```

## Dot Notation

Nested fields are accessed with dot notation:

```js
{ 'address.city': 'Portland' }
{ 'meta.tags': 'featured' }
```

## Comparison Operators

### $eq

Matches documents where the field equals the given value. This is the default when a plain value is used.

```js
// These are equivalent:
{ status: 'active' }
{ status: { $eq: 'active' } }
```

**Null matching:** `{ field: null }` matches documents where the field is `null` *and* documents where the field is missing entirely.

**Array matching:** When the field contains an array, `$eq` matches if *any element* of the array equals the value. `{ tags: 'news' }` matches `{ tags: ['news', 'featured'] }`.

### $ne

Matches documents where the field does *not* equal the given value. Documents where the field is missing also match (since missing is not equal to any value).

```js
{ status: { $ne: 'archived' } }
```

### $gt / $gte / $lt / $lte

Range comparisons. For these to work correctly on numeric and date fields, ensure the appropriate [index type](./indexes.md) is set.

```js
{ price: { $gt: 10 } }
{ price: { $gte: 10, $lte: 100 } }
{ createdAt: { $gt: new Date('2024-01-01') } }
```

**Numbers:** Values are cast to numeric type before comparison, so `9` sorts before `10` (not after, as it would in a text comparison).

**Dates:** Dates stored as `{ $date: "ISO-8601-string" }` are compared as ISO strings, which sort correctly for chronological order.

**Missing fields:** Documents where the field is missing do *not* match range operators.

### $in

Matches documents where the field's value is any of the values in the given array.

```js
{ status: { $in: ['active', 'pending'] } }
```

An empty array matches nothing. If the array contains `null`, documents with missing fields also match.

**Array fields:** If the document field is an array, matches if *any element* of the field is in the `$in` array.

### $nin

Matches documents where the field's value is *not* any of the values in the given array.

```js
{ status: { $nin: ['archived', 'deleted'] } }
```

An empty array matches everything. If the array contains `null`, documents with missing fields are *excluded*. If the array does not contain `null`, documents with missing fields *are* included.

## Logical Operators

### $and

Matches documents that satisfy *all* of the given subqueries. Useful when you need multiple conditions on the same field.

```js
{ $and: [
  { price: { $gte: 10 } },
  { price: { $lte: 100 } }
]}
```

Multiple conditions on different fields in a single object are already an implicit `$and`:

```js
// These are equivalent:
{ status: 'active', type: 'article' }
{ $and: [{ status: 'active' }, { type: 'article' }] }
```

### $or

Matches documents that satisfy *at least one* of the given subqueries.

```js
{ $or: [
  { status: 'active' },
  { featured: true }
]}
```

### $not

Negates a single operator expression. Applied to a specific field.

```js
{ price: { $not: { $gt: 100 } } }
```

## Element Operators

### $exists

Matches documents based on whether a field is present in the document.

```js
{ optionalField: { $exists: true } }   // field is present (even if null)
{ optionalField: { $exists: false } }  // field is absent
```

Note: `$exists: true` matches documents where the field is present, including when the value is `null`. This differs from `{ field: { $ne: null } }`, which excludes both missing and null-valued fields.

## Evaluation Operators

### $regex

Matches string fields against a regular expression.

```js
{ name: { $regex: '^John' } }
{ name: { $regex: 'smith', $options: 'i' } }  // case-insensitive
```

Use `$options: 'i'` for case-insensitive matching.

**Array fields:** If the field contains an array of strings, matches if *any element* matches the pattern.

A JavaScript `RegExp` object can also be passed directly as the value:

```js
{ name: /^John/i }
```

### $text

Full-text search. Requires a [text index](./indexes.md) on the collection.

```js
{ $text: { $search: 'mongodb tutorial' } }
```

The search uses OR semantics — a document matches if it contains *any* of the search terms. In PostgreSQL, this uses `to_tsvector`/`to_tsquery`. In SQLite, this uses pattern matching.

The text search examines the fields `highSearchText`, `lowSearchText`, `title`, and `searchBoost`.

## Array Operators

### $all

Matches documents where an array field contains *all* of the specified values.

```js
{ tags: { $all: ['javascript', 'tutorial'] } }
```

The array must contain every value in the `$all` array, but may contain additional values.

## Array Field Matching

Array fields are queried transparently. A scalar match against an array field succeeds if *any element* of the array matches. This applies to all operators:

```js
// Document: { tags: ['news', 'featured'] }

{ tags: 'news' }                    // matches (element equality)
{ tags: { $in: ['news', 'other'] } } // matches (element in array)
{ tags: { $regex: '^new' } }        // matches (element matches pattern)
{ tags: { $all: ['news', 'featured'] } }  // matches (all elements present)
```
