---
"apostrophe": patch
---

Page data sent to Astro and other external fronts no longer includes `bestPage`, which only serves to populate `page` and made the payload a third larger; use `page` instead. A project that still needs it can restore it by extending the `pruneDataForExternalFront(req, template, data, moduleName)` method of `@apostrophecms/template` and setting `data.bestPage = req.data.bestPage`.
