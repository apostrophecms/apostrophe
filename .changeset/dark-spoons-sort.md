---
"sanitize-html": patch
---

Fix unclosed tags (e.g., `<hello`) returning empty string in `escape` and `recursiveEscape` modes. Fixes [#706](https://github.com/apostrophecms/sanitize-html/issues/706).
Thanks to [Byeong Hyeon](https://github.com/choi2601) for the fix.
