---
"apostrophe": patch
---

The `email` schema field now validates and stores the laundered value, so surrounding whitespace is trimmed rather than causing a valid address to be rejected as invalid. Non-string input (for example a number sent through the REST API) is now coerced by the launder step instead of throwing an uncaught error.
