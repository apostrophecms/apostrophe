---
"apostrophe": patch
---

Security: the text of fields protected by a `viewPermission` was included in a document's search index (`highSearchText`, `lowSearchText`, `highSearchWords` and `searchSummary`). A user who could view the document but not the field could read that text through those properties in REST API responses, and could find the document by searching for it. Fields with a `viewPermission`, including any fields, areas and widgets nested inside them, are no longer indexed for search, so their text is no longer matched by search or autocomplete for any user. This only affects sites that set `viewPermission` on fields containing text. Existing documents keep their old search text until they are saved again, so such sites should run `node app @apostrophecms/search:index` after upgrading (CWE-200, GHSA-69r4-gcp7-c67r).
