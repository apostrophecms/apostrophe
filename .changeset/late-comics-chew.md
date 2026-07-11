---
"@apostrophecms/apostrophe-astro": patch
---

Fixed a bug where redirect responses proxied through `aposProxy.js` (e.g. OAuth login callbacks) lost every header except `Location`. This affected setups where Apostrophe is only reachable through the Astro proxy (e.g. a sidecar deployment), causing the session `Set-Cookie` header from an OAuth callback redirect to be silently dropped and the login to appear to fail.
