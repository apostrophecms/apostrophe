# @apostrophecms/db-connect

## 1.1.0 (2026-09-30)

### Adds

- Adds support for TTL indexes (`expireAfterSeconds`) to the PostgreSQL and SQLite adapters. As in MongoDB, a background task removes expired documents every 60 seconds.
- Export the driver's `EJSON` (Extended JSON) so apostrophe modules can serialize documents without a direct driver dependency.

### Fixes

- The postgres cursor returns its pooled connection when iteration stops early: on a query error inside `next()`, and when a `for await` loop exits through `break`, `return` or a throwing body. Previously each abandoned cursor kept a connection checked out for the life of the process (PRO-10051).
- The postgres adapter's `sort()` orders numbers numerically instead of as text, so `10` no longer sorts before `2` and the children of a page with ten or more of them stay in rank order (PRO-10055).

### Security

- On the SQLite and PostgreSQL adapters, the in-memory helpers that apply projections and update operators to dotted field paths did not stop a path from walking into `Object.prototype` or other built-ins shared by the whole Node.js process. Since the `project` query builder of the REST API accepts field names from logged-in users with editing access, a single request could delete a built-in method such as `hasOwnProperty` and break the site for every user until restart. Field paths containing `__proto__`, `constructor` or `prototype` are now ignored, and the helpers only traverse properties a document actually has, never inherited ones. As defense in depth, the `project` query builder now also discards field names containing those segments. The default MongoDB adapter was not affected (CWE-1321, CWE-400, GHSA-j5rq-xfvr-p969).

  Thanks to [Daniel Coles](https://github.com/manus-pi) and [Jace](https://github.com/manus-use) for reporting the vulnerability.

## 1.0.2 (2026-09-03)

### Fixes

- Fixed the sqlite adapter rejecting a Windows database path in `DB_URI`. The sqlite adapter now expects everything after `sqlite:` to be a filesystem path and accepts both Windows and POSIX-style paths. This corrects an issue that prevented new projects from spinning up in the CLI when using `sqlite`.

## 1.0.0, 1.0.1

- Initial releases (no significant differences).

