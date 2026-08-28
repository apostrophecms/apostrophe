---
"apostrophe": patch
---

Fix: starting in version 2.17.6, `sanitize-html` began escaping any markup preserved inside a disallowed iframe tag, which was a change
in behavior due to an upstream change in `htmlparser2`. This fix ensures such "fallback markup" is preserved without escaping, but also
fully sanitized according to the same rules as the original input. Thanks to [sumitjhacodes](https://github.com/sumitjhacodes) for
the fix.

