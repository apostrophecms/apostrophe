---
"apostrophe": patch
---

Security: the bearer token middleware did not check that the token was a string. Because query string parameters are parsed with bracket syntax, an unauthenticated request could supply a database query operator in place of the `access_token` parameter, match an existing valid bearer token and act as its owner, including administrators. Bearer tokens that are not strings are now rejected with a 401 response. Exploitation required at least one unexpired bearer token to exist, i.e. a `session: false` login within the token lifetime (two weeks by default). All database adapters were affected (CWE-943, CWE-287, GHSA-jj89-69wm-jj39).

Thanks to [Srikanth . T](https://github.com/Srikanth786369) for reporting the vulnerability.
