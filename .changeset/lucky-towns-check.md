---
"apostrophe": minor
---

In `@apostrophecms/i18n` add `direction` property to locale configuration to support RTL languages (e.g., `he`, `ar`), `slugDirection` option to control default direction of slug fields. Add `direction` property in the schema field definitions to override and validate text direction (supports `ltr` and `rtl`) of input fields. Note that the admin UI layout and labels overall are still LTR only for now, but these changes accommodate editing RTL locale content within that. For best results the feature should be combined with `adminLocales` and `defaultAdminLocale` module options, e.g. the admin UI itself should remain in English or another LTR language for now.
