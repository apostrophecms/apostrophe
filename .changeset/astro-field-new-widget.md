---
"apostrophe": patch
"@apostrophecms/apostrophe-astro": patch
---

Fields rendered in place with `AposField` in a widget can be edited as soon as the widget is added or saved in Astro, rather than only after the page is refreshed. Rich text fields in such a widget no longer appear as escaped markup during live preview and inline editing. Empty fields of a widget that was just saved can be selected and edited on the page right away, as they can be in a Nunjucks or JSX project.
