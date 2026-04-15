---
"apostrophe": patch
---

Security: fixed an XSS vulnerability. Color fields formerly accepted -- followed by anything, including </style>, which could be used to inject other markup. Thanks to [restriction](https://github.com/restriction) for reporting the issue and proposing the fix.

