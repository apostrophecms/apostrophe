---
"apostrophe": patch
"express-cache-on-demand": minor
---

A page request from an external front end, such as Astro, and an ordinary browser request for the same URL that arrive at the same time no longer share a single response through cache-on-demand. Previously the browser could receive the JSON meant for the external front end, or the external front end could receive HTML. `express-cache-on-demand` now exports its default hasher as `expressHasher`, so that a custom hasher can build on its rules.
