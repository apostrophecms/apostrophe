---
"apostrophe": patch
---

The `@apostrophecms/oembed` module now caches failed lookups in addition to successful ones. Previously only successes were cached, so a bad or removed URL (such as a deleted YouTube video) could be requested over and over, triggering provider rate-limiting (e.g. YouTube 429 errors) and temporary lockouts. Cached entries written by older versions of Apostrophe are still tolerated, so no cache clearing is required when upgrading. In addition, the underlying error is now logged (via structured logging) before the higher-level "Video URL invalid" error is thrown, making the original cause easier to diagnose.
