---
"apostrophe": patch
---

A `{% render %}` or `{% component %}` tag at the top level of a template brought in with `{% import %}` no longer crashes the page with "Cannot read properties of undefined (reading 'data')". Nunjucks discards that output anyway, so the tag is skipped and a one-time warning explains how to fix the template.
