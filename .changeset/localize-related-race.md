---
"apostrophe": patch
---

The Localize dialog no longer loses its related documents choice when a setting changes before the document has finished loading. Related documents were then looked for in the partial document the dialog starts with, none were found, and the dialog settled on "This document" for good. The dialog now shows as busy until the document is loaded, and only the latest check of related documents counts.
