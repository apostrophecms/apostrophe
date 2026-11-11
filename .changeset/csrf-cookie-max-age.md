---
"apostrophe": patch
---

The CSRF cookie now lasts one year, as intended. Its `maxAge` was given in seconds, but Express expects milliseconds, so the cookie expired after about nine hours.
