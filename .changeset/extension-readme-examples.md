---
"@apostrophecms/import-export": patch
"@apostrophecms/form-submission-google": patch
"@apostrophecms/apostrophe-astro": patch
"@apostrophecms/cache-redis": patch
---

Corrected README code examples that would not run as written: a `const` declaration using `:` instead of `=`, two missing commas between object properties, a stray line above an unrelated example, and a pagination example referencing an undestructured variable and comparing a page object to a page number. Also fixed a misplaced backtick in the import-export format documentation.
