---
"apostrophe": patch
---

Widget preview rendering are now properly debounced in cases where the server does not return the first preview before
the timeout to generate a second preview arrives. Apostrophe will always wait for a previous render before attempting
a new one based on the latest data available. This greatly mitigates the performance impact on the server if
a widget is particularly slow and expensive to preview.
