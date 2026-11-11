---
"apostrophe": patch
---

Fixes a `debounce:canceled` error when a widget with live preview failed validation on save and was then edited again. Also fixes undo of a padding or margin change made in a widget's styles: the box field no longer changes the widget on the page before the edit is saved.
