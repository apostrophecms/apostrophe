---
"apostrophe": patch
---

A relationship field with an array `withType` now fails at startup, instead of passing validation and throwing on every query that loads it.
