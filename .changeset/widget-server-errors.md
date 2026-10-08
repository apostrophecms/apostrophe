---
"apostrophe": patch
---

Widget editor modals now show server-side validation errors on the fields they belong to. When a widget's `sanitize` method throws an `invalid` error whose `data.errors` entries name fields by `path`, the modal switches to that field's tab and displays the message beneath it. Previously the save was blocked with no feedback at all.
