---
"apostrophe": patch
---

Document versions no longer list a change between two empty values, such as a field missing from an older document and saved empty since; recorded change counts are updated on upgrade. A `range` field without a default saved with no value is now unset, as in the editor, instead of `0`.
