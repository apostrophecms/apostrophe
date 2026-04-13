---
"apostrophe": patch
---

Removed misleading return from pruneDataForExternalFront, a method intended to be overridden to modify data "in place" before it is sent to Astro or a similar frontend.
