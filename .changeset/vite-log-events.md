---
"@apostrophecms/vite": minor
---

Vite's own build output is indented under the build entry it belongs to in the human log formats, and becomes structured events when the format is machine readable; the build and HMR notices carry event types. A logged error's `stack` is the stack string itself, no longer an array of trimmed lines.
