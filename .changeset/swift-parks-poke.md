---
"apostrophe": patch
---

Preserve UTF-8 filenames when uploading attachments, rather than converting incorrectly to `latin1` as `multer` does by default.

Thanks to [yoshimasa sugawara](https://github.com/y-sugawara179) for this fix.
