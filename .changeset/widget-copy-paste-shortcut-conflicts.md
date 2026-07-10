---
"apostrophe": patch
---

Fixed the widget copy shortcut (Ctrl+C / Cmd+C) hijacking native text copy in edit mode. With an active text selection, the cut, copy and remove (Backspace) widget shortcuts now defer to the browser. Pasting a widget with Ctrl+V / Cmd+V now checks that the widget copy is still the most recent thing in the system clipboard, so text copied elsewhere in the meantime is no longer shadowed by a stale widget paste. The widget clipboard storage remains backward compatible with entries written by previous releases.
