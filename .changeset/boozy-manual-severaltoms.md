---
"sanitize-html": patch
---

Security: added a number of new attributes to be protected against unsafe URLs, e.g. `javascript:` and similar. None of these are used in the default configuration of `sanitize-html` or `apostrophe` or likely to be used there, and some attributes, like an `action` for a `form`, are inherently unsafe to allow if XSS protection is your goal. Nevertheless it makes sense to block certain URL types where they are not appropriate. Some attributes are not supported at all by modern browsers but are included for completeness. Thanks to [crattack](https://github.com/crattack) for reporting the vulnerability.
