---
"apostrophe": patch
---

Fixed a field edited in place with the `{% field %}` tag leaving the browser's copy of the widget it belongs to out of date. The edit was patched to the document on the server and nothing else was told, so copying, cutting or duplicating that widget, or opening its editor, went on working from the value the page had been rendered with, and the user's typing was quietly undone. Every area editor holding the widget, at any depth, now hears about the edit and updates its own copy.
