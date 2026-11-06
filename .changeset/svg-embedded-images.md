---
"apostrophe": patch
---

SVG uploads keep bitmaps embedded with `<image xlink:href="data:image/png;base64,...">`, as exported by many design tools. Previously the SVG sanitizer removed these elements, so parts of the image disappeared. Embedded SVG documents and external references are still removed.
