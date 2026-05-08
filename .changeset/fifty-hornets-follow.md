---
"apostrophe": patch
---

- Removed duplicate <meta charset> tag from `outerLayoutBase.html`
- Standardized charset to utf-8 (the legacy configuration option is now ignored). Per the spec this is the only legal setting, so we classify this as a bug fix
- Altered unused/legacy i18n template helper to return `utf-8`, ensuring backwards compatibility
