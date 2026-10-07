---
"@apostrophecms/seo": patch
---

`llms.txt` and `robots.txt` no longer answer 200 when they have nothing to serve: a disabled `llms.txt` answers 404, and a failure while generating either file answers 500.
