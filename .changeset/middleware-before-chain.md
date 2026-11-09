---
"apostrophe": patch
---

Chained `before` options on middleware and routes now resolve transitively. If module A's middleware asks to run before module B, and B's middleware asks to run before module C, A's middleware now runs first; previously it ran last.
