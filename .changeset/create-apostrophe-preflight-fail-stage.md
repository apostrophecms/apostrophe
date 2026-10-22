---
"create-apostrophe": patch
---

Telemetry for an install that stops before any stage runs (for example, an unsupported package manager) now reports `failStage` as `preflight` instead of `null`, so the field always has the same type.
