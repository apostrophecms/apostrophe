---
"apostrophe": patch
---

A change made over MCP records which connected tool made it. Each change-log entry from the MCP server holds the tool's OAuth client id and the name it gave (`client: { id, name }`). A door passes the tool to `apos.harness.withDoor` as `client`; the assistant's entries record `client: null`.
