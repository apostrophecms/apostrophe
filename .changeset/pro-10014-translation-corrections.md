---
"apostrophe": patch
"@apostrophecms/form": patch
"@apostrophecms/i18n-static": patch
---

Corrects mistranslated, truncated and partly English admin UI strings in de, es, fr, it, pt-BR and sk. Slovak plurals now use the numbered forms i18next expects for Slovak (`key_1` for 2–4, `key_2` for 0 and 5+), so counts no longer always show the singular. Fixes the German date format rendering "Uhr" as an hour.
