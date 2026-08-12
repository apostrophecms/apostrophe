---
"apostrophe": minor
---

Every diagnostic Apostrophe writes is now a structured event rather than a raw `console` call: boot and cluster notices, fatal startup errors, deprecations, runtime error catches, and long-running tasks, which report a start, one progress line per 100 items and a summary instead of one line per item. Task help, listings and other program output are unchanged.
