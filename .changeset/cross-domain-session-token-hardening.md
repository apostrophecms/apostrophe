---
"apostrophe": patch
"@apostrophecms/passport-bridge": patch
---

Security: hardened the single-use token that moves a logged-in session to a locale served from another hostname. The token was generated with a non-cryptographic ID generator, stayed valid for an hour, could be redeemed on any hostname, and could be redeemed more than once by simultaneous requests. It is now 256 bits from a cryptographically secure source, expires after 60 seconds, is accepted only on the hostname it was minted for, and is consumed atomically. The redirect that strips it from the URL is sent with `Referrer-Policy: no-referrer` and `Cache-Control: no-store`. The session is adopted under a freshly generated session id, and an invalid token no longer wipes the visitor's existing session. `@apostrophecms/passport-bridge` now mints its cross-locale tokens through the same code (CWE-598, CWE-384, GHSA-hhvr-8m24-qqr3).

Thanks to [Anisetti Chaitanya Eshwar Prasad](https://github.com/chaitanyaeshwarprasad) for responsibly reporting the vulnerability.
