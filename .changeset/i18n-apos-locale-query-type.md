---
"apostrophe": patch
---

A request whose `aposLocale` query parameter is not a plain string, such as `?aposLocale[a]=1` or a repeated `aposLocale`, no longer fails with a 500 error. It is ignored, just as if the parameter were missing, and the locale is chosen from the hostname and path prefix as usual.
