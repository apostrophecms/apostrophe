---
"uploadfs": patch
---

The `orientOriginals` and `copyOriginal` options now take effect when passed to `init`, as documented, instead of only when passed to each `copyImageIn` call. In Apostrophe this means `orientOriginals: false` in the `uploadfs` option of `@apostrophecms/uploadfs` stores uploaded originals unchanged. A value passed to `copyImageIn` still takes precedence.
