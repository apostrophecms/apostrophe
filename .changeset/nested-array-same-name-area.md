---
"apostrophe": patch
---

Fix a server error when a nested array shares the same name as its parent array and an area field is present in the schema. The nested array no longer overwrites the parent array's manager, so an area rendered on an array item resolves its field correctly. Thanks to [Michael Lip](https://github.com/theluckystrike) for the contribution.
