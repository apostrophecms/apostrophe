---
"apostrophe": patch
---

Schema field `_id` properties are now derived from the position of the field in the schema tree, such as `doc.article.pets.petName`, rather than hashed from the field definition. Ids hashed from the definition changed whenever an unrelated property such as a label was edited, so two processes running slightly different code, as during a rolling deploy, did not agree on them and a field id already held by the browser could be rejected as invalid. Position-based ids only change when a field is renamed or moved, and are readable when debugging.

`apos.schema.register` now requires a fourth `parentPath` argument and throws if it is missing. If you have overridden a method that calls `apos.schema.register` you must pass it through; the error message includes guidance.

The `scopedArrayName` and `scopedObjectName` properties are unchanged, keeping their existing form and continuing to honor the `arrayName` and `objectName` options, because they are stored in the database on every array item and object. No migration is required.
