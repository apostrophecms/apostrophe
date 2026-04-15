---
"sanitize-html": patch
---

Fix vulnerability introduced in version 2.17.2 that allowed XSS attacks if the developer chose to permit `option` tags. There was no vulnerability when not explicitly allowing `option` tags.
