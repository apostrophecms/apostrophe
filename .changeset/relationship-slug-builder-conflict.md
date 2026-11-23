---
"apostrophe": patch
---

Apostrophe now warns at startup when a relationship field's slug query builder has the same name as another field of the same doc type. A relationship field such as `_author` gets query builders named `author` and `authorAnd`, which accept slugs of the related documents. If the same doc type also has a field named `author`, only one of the two fields gets the `author` query builder, so filtering by the other does not work as expected. Rename one of the two fields to resolve this.
