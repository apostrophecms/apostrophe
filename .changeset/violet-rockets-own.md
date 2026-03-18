---
"@apostrophecms/import-export": patch
---

Security: fixed vulnerability that allowed any user with permission to edit the global settings document, e.g. headers, footers, etc., to potentially deface the site by writing files to the public/ folder or overwrite site code accessible to the same Linux account that runs the server process. This vulnerability was not publicly disclosed prior to the release of this fix. Upgrading immediately is strongly recommended for those using the import-export module. Thanks to 0xEr3n for reporting the vulnerability and providing test cases.

