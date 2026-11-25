---
"launder": patch
---

`launder.url` now accepts the `mailto:`, `tel:` and `sms:` schemes in any letter case. Previously `MAILTO:someone@example.com` was mistaken for a domain name and returned as `http://MAILTO:someone@example.com`.
