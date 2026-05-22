---
"@apostrophecms/cli": patch
---

Security: passwords and starter kit URLs containing intentionally malicious punctuation cannot be used to run arbitrary shell commands. Because the CLI is only used by developers, this would always have been an "own goal" situation, however this does make the CLI more robust for scripted use. Thanks to [Nitro13urn](https://github.com/VadlaReddySai) for reporting the issue.
