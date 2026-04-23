# Update Operators

Update operators modify documents in place. They are used with `updateOne`, `updateMany`, `findOneAndUpdate`, and in `bulkWrite` operations.

Multiple operators can be combined in a single update:

```js
await collection.updateOne(
  { _id: 'abc' },
  {
    $set: { title: 'Updated' },
    $inc: { revision: 1 },
    $currentDate: { updatedAt: true }
  }
);
```

## $set

Sets the value of one or more fields. Creates the field if it does not exist. Overwrites the existing value if it does.

```js
{ $set: { title: 'New Title' } }
{ $set: { 'address.city': 'Portland', 'address.state': 'OR' } }
```

Dot notation creates nested structures automatically. An `undefined` value is stored as `null`.

## $unset

Removes one or more fields from the document. The value given for each field is ignored — any truthy value works.

```js
{ $unset: { obsoleteField: 1 } }
{ $unset: { 'nested.field': '', otherField: true } }
```

## $inc

Increments a numeric field by the given amount. If the field does not exist, it is created with the increment as its value (starting from `0`).

```js
{ $inc: { views: 1 } }           // increment by 1
{ $inc: { stock: -3 } }          // decrement by 3
{ $inc: { views: 1, shares: 1 } } // increment multiple fields
```

Use negative values to decrement.

**Upsert behavior:** When used with `upsert: true` and no document matches, `$inc` creates the field with the increment value (e.g., `{ $inc: { count: 5 } }` creates `count: 5`).

## $push

Appends a value to an array field. Creates the array if the field does not exist.

```js
{ $push: { tags: 'new-tag' } }
{ $push: { comments: { author: 'Alice', text: 'Great post' } } }
```

Each `$push` appends a single element. To append to multiple array fields, include them all in one `$push`:

```js
{ $push: { tags: 'new-tag', categories: 'tutorials' } }
```

> **Note:** The `$each` modifier is not supported. To add multiple elements, use multiple updates or a read-modify-write pattern.

## $pull

Removes *all* occurrences of a value from an array field. Uses deep equality, so it works with objects and nested arrays.

```js
{ $pull: { tags: 'old-tag' } }
{ $pull: { items: { sku: 'ABC123' } } }  // removes matching objects
```

## $addToSet

Adds a value to an array field only if it is not already present. Uses deep equality for comparison.

```js
{ $addToSet: { tags: 'unique-tag' } }
```

If the value already exists in the array, the array is not modified.

> **Note:** The `$each` modifier is not supported.

## $currentDate

Sets a field to the current date as a JavaScript `Date` object.

```js
{ $currentDate: { updatedAt: true } }
{ $currentDate: { updatedAt: { $type: 'date' } } }
```

Both forms are equivalent. Only the `'date'` type is supported.
