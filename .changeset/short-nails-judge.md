---
"sanitize-html": patch
---

Test each class and style value independently when an allowlist regular expression uses the global or sticky flag. Reusing these expressions no longer drops matching classes or declarations, and sanitizing preserves their original `lastIndex`.
