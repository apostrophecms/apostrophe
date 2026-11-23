---
"apostrophe": patch
---

The MCP server offers `publish_document`, so an outside AI tool can publish what the connected user may publish. It's marked destructive, so MCP clients ask before running it. Set the `@apostrophecms/mcp` module's `publish` option to `false` to keep publishing off the MCP server; the assistant keeps it.
