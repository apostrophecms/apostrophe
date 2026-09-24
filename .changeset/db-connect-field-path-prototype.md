---
"@apostrophecms/db-connect": patch
"apostrophe": patch
---

Security: on the SQLite and PostgreSQL adapters, the in-memory helpers that apply projections and update operators to dotted field paths did not stop a path from walking into `Object.prototype` or other built-ins shared by the whole Node.js process. Since the `project` query builder of the REST API accepts field names from logged-in users with editing access, a single request could delete a built-in method such as `hasOwnProperty` and break the site for every user until restart. Field paths containing `__proto__`, `constructor` or `prototype` are now ignored, and the helpers only traverse properties a document actually has, never inherited ones. As defense in depth, the `project` query builder now also discards field names containing those segments. The default MongoDB adapter was not affected (CWE-1321, CWE-400, GHSA-j5rq-xfvr-p969).

Thanks to [Daniel Coles](https://github.com/manus-pi) and [Jace](https://github.com/manus-use) for reporting the vulnerability.
