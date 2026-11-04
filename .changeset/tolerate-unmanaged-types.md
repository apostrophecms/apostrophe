---
"apostrophe": patch
---

Leftover documents of a page or piece type whose module was removed from the project no longer break the admin UI or the upgrade. Page and piece REST responses that include them, such as the page tree, no longer fail with a 500 error. The document versions upgrade migrations skip them with a warning instead of stopping, and their version history still loads. Copying a document that holds a widget of a removed type no longer fails: the copy drops that widget with a warning, as saving the document already did. Thanks to [Alt Studios](https://github.com/apostrophecms/apostrophe/issues/5705) for the report.
