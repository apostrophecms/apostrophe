---
"@apostrophecms/event": patch
---

Repeating events keep their series link when published. `eventGroupId` and `isClone` are now hidden, read-only schema fields, so they are copied to the published document and can't be changed or cleared through the API.
