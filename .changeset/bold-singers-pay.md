---
"apostrophe": minor
---

Added support for pretty URL file attachments in the static build metadata pipeline. When `@apostrophecms/file` has `options.prettyUrls` enabled, the getAllUrlMetadata API now annotates affected attachment properly. The backend streaming proxy route was also fixed to correctly resolve relative uploadfs URLs during static builds.
