---
"@apostrophecms/import-export": patch
---

The two hidden notifications used to carry the locale-differs and duplicated-docs events to the browser now dismiss themselves. Nothing ever dismissed them, so every import that hit either path left a permanent notification in the database, re-sent to the browser on every admin page load thereafter.
