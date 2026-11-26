---
"apostrophecms-openapi": minor
---

Documents the Document Versions endpoints under the new Document Versions tag: `GET /@apostrophecms/document-versions` lists a document's versions, `GET /@apostrophecms/document-versions/{_id}` returns one with its content, `GET /@apostrophecms/document-versions/{_id}/changes` returns its change list, and `GET /@apostrophecms/document-versions/draft-changes` lists the changes of a draft since its last publication, as See Changes shows them. Page and piece write bodies document the `_restoreVersion`, `_explicitSave` and `_ai` save flags, and PATCH bodies document `_strict`, which saves only if the whole document is then valid.
