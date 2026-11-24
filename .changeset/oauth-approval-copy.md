---
"apostrophe": patch
---

The OAuth approval page now says what a connected AI tool can do with the MCP server's `publish` option in mind: with publishing on (the default) it says the tool can publish, and with `publish: false` it says changes are saved as drafts. The page also has a "Not you?" button beside the signed-in user, which logs them out and sends them to log in again, then back to the same request. It also says where to disconnect the tool later. The logout route's work is now the `@apostrophecms/login` module's `logOut(req)` method, for any code that must log a user out.
