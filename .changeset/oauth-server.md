---
"apostrophe": minor
---

Adds `@apostrophecms/oauth` (`apos.oauth`), an OAuth 2.1 authorization server, so that outside tools such as AI clients can act as a user with that user's approval. A module that accepts its tokens registers its route with `apos.oauth.addResource(path, { name, description })` and answers a request without a valid token with `apos.oauth.challenge(res, path)`. The server is off until a resource registers, or `enabled: true` is set; `enabled: false` keeps it off. While it's on, the site's `baseUrl` is required, and a site with a `prefix` is not supported yet.

It serves the authorization server and protected resource metadata documents (RFC 8414 and RFC 9728), registers public clients by dynamic client registration (RFC 7591) or client ID metadata documents (set `clientMetadataDocuments: false` on a host that allows no outbound requests), and asks for the user's approval at its authorize endpoint, with PKCE (S256) required. The approval page names the tool, the site and the user, and shows each resource's own description. A request that can't go on gets an error page that says what happened in plain language and keeps the technical details for the tool's developer apart. The module logs registrations, approvals and refusals at `info`, and unknown clients, unregistered redirect URIs and client metadata documents that couldn't be fetched at `warn`.
