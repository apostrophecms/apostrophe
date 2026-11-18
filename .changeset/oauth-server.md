---
"apostrophe": minor
---

Adds `@apostrophecms/oauth` (`apos.oauth`), an OAuth 2.1 authorization server, so that outside tools such as AI clients can act as a user with that user's approval. A module that accepts its tokens registers its route with `apos.oauth.addResource(path, { name, description })` and answers a request without a valid token with `apos.oauth.challenge(res, path)`. The server is off until a resource registers, or `enabled: true` is set; `enabled: false` keeps it off. While it's on, the site's `baseUrl` is required, and a site with a `prefix` is not supported yet.

It serves the authorization server and protected resource metadata documents (RFC 8414 and RFC 9728), registers public clients by dynamic client registration (RFC 7591) or client ID metadata documents (set `clientMetadataDocuments: false` on a host that allows no outbound requests), and asks for the user's approval at its authorize endpoint, with PKCE (S256) required. The approval page names the tool, the site and the user, and shows each resource's own description. A request that can't go on gets an error page that says what happened in plain language and keeps the technical details for the tool's developer apart.

Its token endpoint exchanges a code for an access token, which lasts an hour, and a refresh token, which lasts 30 days and is replaced each time it's used. A code or refresh token that is used a second time ends the whole connection, since someone else may have a copy. Its revoke endpoint (RFC 7009) ends a connection from either token. Only the hashes of codes and tokens are stored. A resource checks a request's token with `apos.oauth.verifyAccessToken(token, { resource })`, which returns the user, or null for a token that is unknown, expired, revoked, issued for another resource, or whose user can no longer log in.

The module logs registrations, approvals, refusals, tokens issued and refreshed, and revocations at `info`, and unknown clients, unregistered redirect URIs, client metadata documents that couldn't be fetched, and codes or refresh tokens used twice at `warn`. No code or token is ever logged.
