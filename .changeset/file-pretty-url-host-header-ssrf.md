---
"apostrophe": patch
---

Security: when `@apostrophecms/file` pretty URLs are enabled (`prettyUrls: true`), the upstream request used to serve the file is no longer built from the incoming `Host` header. The self-request is now resolved against the site's configured `baseUrl` (via `req.baseUrl`), falling back to the request host only when no `baseUrl` is configured. This closes a server-side request forgery (SSRF) vector in which the `Host` header could steer the proxied fetch at another host. The real-world risk was low: the path is constrained to an existing attachment's `/uploads/attachments/<cuid>-<slug>.<ext>`, and cuids are unique and immutable, so any reachable content was already public via the front door. Thanks to [EchoSkorJjj](https://github.com/EchoSkorJjj) for reporting the issue.
