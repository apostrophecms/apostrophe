---
"apostrophe": patch
---

The undo and redo keyboard shortcuts no longer seize `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z` while a modal is open. In-context undo and redo apply to the page being edited, so triggering them from a dialog rolled back changes the editor could not see. The keystroke is now left to the browser in that situation, restoring native text undo inside the dialog, and page-level undo and redo continue to work as before when no modal is open.
