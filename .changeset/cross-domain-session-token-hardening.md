---
"apostrophe": patch
---

Security: hardened the single-use token that moves a logged-in session to a locale served from another hostname. The token was generated with a non-cryptographic ID generator, stayed valid for an hour, could be redeemed on any hostname, and could be redeemed more than once by simultaneous requests. It is now 256 bits from a cryptographically secure source, expires after 60 seconds, is accepted only on the hostname it was minted for, and is consumed atomically. The redirect that strips it from the URL is sent with `Referrer-Policy: no-referrer` and `Cache-Control: no-store`. The session is adopted under a freshly generated session id, and an invalid token no longer wipes the visitor's existing session (CWE-598, CWE-384, GHSA-hhvr-8m24-qqr3).

In addition, the `@paralleldrive/cuid2` dependency has been updated to version 3, which draws on the platform's cryptographically secure random number generator rather than `Math.random`. This strengthens every identifier and token Apostrophe generates with it, including login bearer tokens and password reset tokens. The format of generated ids is unchanged.

Thanks to [Anisetti Chaitanya Eshwar Prasad](https://github.com/chaitanyaeshwarprasad) for reporting the vulnerability.
