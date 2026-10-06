---
"apostrophe": patch
"@apostrophecms/import-export": patch
---

Fix interpolation variables that were mistyped or translated in several locales, which made i18next render them as empty strings. The batch localization notifications now show the localized and skipped document counts in German, Spanish, Italian, Portuguese (Brazil) and Slovak, the minimum image size shows its dimensions in Spanish and Slovak, and the import error notifications show the file type in all translated locales. The German "Create new" command menu label no longer has the English text appended. A test now checks that bundled translations only use variables declared in `en.json`. Thanks to [Michael Lip](https://github.com/theluckystrike) for the contribution.
