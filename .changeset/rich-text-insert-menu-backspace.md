---
"apostrophe": patch
---

Fixed pressing Backspace right after typing `/` in a rich text widget deleting the entire widget. Backspace now removes the slash and closes the insert menu. Global command menu shortcuts also no longer fire for key events already handled and prevented by other UI components.
