---
"apostrophe": patch
---

Fix a server error when a nested array has the same name as its parent array and the parent's items contain an area. Nested objects that share a name with their parent object are fixed as well. Array items and objects now record the `_id` of their own field as `arrayFieldId` or `objectFieldId`, so each is matched to its own schema. Migrations add these to existing content and document versions, including versions converted from `@apostrophecms-pro/document-versions`. `scopedArrayName` and `scopedObjectName` are still written, so servers running the previous version during a rolling deployment keep working. Thanks to [Michael Lip](https://github.com/theluckystrike) for bringing this issue to our attention.
