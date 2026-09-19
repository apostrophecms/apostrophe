---
"apostrophe": patch
"@apostrophecms/import-export": patch
---

Fixes translated strings whose interpolation variables were misspelled or translated (e.g. `{{ skipcount }}`, `{{ ancho }}`, `{{ format }}`), so values like counts, image dimensions and file types now render in de, es, fr, it, pt-BR and sk. Removes two stale Slovak tag keys.
