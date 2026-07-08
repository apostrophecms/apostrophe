---
"sanitize-html": patch
---

Allow transformTags to emit text when textFilter is set, even if the tag
is initially empty. This is consistent with the documentation. Thanks to
[spokodev](https://github.com/spokodev) for the fix.
