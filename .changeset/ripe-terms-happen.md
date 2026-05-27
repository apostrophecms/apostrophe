---
"@apostrophecms/apostrophe-astro": minor
"apostrophe": minor
---

Fixed adding or removing an area field from a schema breaking existing documents on an external front such as Astro.

- `AposArea` now renders only schema-backed areas. A missing area no longer throws, and an area orphaned by removing its field from the schema (while its content remains in the document) renders nothing instead of breaking sibling areas in edit mode. Logged-in editors get a diagnostic message in place of an orphaned area; anonymous visitors see nothing.
- Editable documents sent to an external front now materialize empty area objects for schema area fields added after the document was created, so they can be edited in context. This happens in memory, without writing to the database during a render.
- `apos.util.getManagerOf` accepts a `{ log }` option to suppress its error log when probing objects that may not have a manager.

