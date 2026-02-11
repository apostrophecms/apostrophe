---
"@apostrophecms/cli": patch
---

- Validates the `shortName` argument in the `create` command to only allow letters, numbers, hyphens, and underscores, preventing potential command injection.
