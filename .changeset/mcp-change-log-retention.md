---
"apostrophe": minor
---

The MCP server's change log entries now expire. An entry is kept for `changeLogExpireAfter` seconds after the change, 180 days by default, and `0` keeps entries for good. A sweep runs every hour while the server is on, and `node app @apostrophecms/mcp:expire-changes` runs one on demand, also on a site where the server has been turned off. Only entries from MCP changes are removed; the assistant's entries are kept, as before, until their chat is deleted.
