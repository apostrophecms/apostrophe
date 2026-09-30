---
"apostrophe": minor
---

Added support for `draggable: false` on non-inline `array` schema fields. Previously this option was only respected when `inline: true`. When set on a standard (modal-based) array field, drag-and-drop reordering and keyboard reordering are now disabled in the array editor's slat list.
