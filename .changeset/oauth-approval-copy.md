---
"apostrophe": patch
---

The OAuth approval page now says whether a connected AI tool can publish. It says so only when the MCP server's `publish` option is on (the default) and the signed-in user may publish at least one type that keeps drafts. Otherwise, for example with `publish: false` or for a contributor, it says changes are saved as drafts. The page also has a "Not you?" button beside the signed-in user, which logs them out and sends them to log in again, then back to the same request. It also says where to disconnect the tool later. The logout route's work is now the `@apostrophecms/login` module's `logOut(req)` method, for any code that must log a user out.
