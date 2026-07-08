---
"@apostrophecms/import-export": patch
---

Security: hardened archive extraction against a denial-of-service hang (CWE-835). A crafted `.tar.gz` import whose archive contained a *directory* entry with a `../` traversal sequence in its name was correctly rejected by the zip-slip guard, but the extractor never advanced to the next tar entry for directories, so extraction never emitted `finish`, the extraction promise never resolved, and the import request/job hung indefinitely — leaving the uploaded file and a partially-extracted directory on disk. Repeated imports could exhaust connections and disk. The extractor now always drains and advances past a rejected entry regardless of its type. Reaching this requires an authenticated account permitted to import. Found during an internal security review.
