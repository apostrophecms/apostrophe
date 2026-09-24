---
"uploadfs": patch
---

Security: when the Azure backend was configured with a SAS token (`sas: true`), `getUrl()` returned a base URL that still carried the SAS token as its query string, so the credential was included in public attachment URLs (CWE-522, CWE-200, GHSA-hhph-8536-gfq5). `getUrl()` now strips the query string from the container URL, so public URLs contain no credentials and are well formed. The top-level `sas` option is now also honored when `replicateClusters` is not used, as documented.

The practical impact is expected to be very limited, because this configuration could not have worked in production:

- The file path was appended after the query string, which altered the signature, so every attachment URL generated this way was broken. A site in this state would not have displayed any images or served any file downloads.
- The top-level `sas: true` option was ignored, so a SAS token configured that way was treated as an account key and could not authenticate. Only a `sas: true` setting inside `replicateClusters` took effect, and only when that was the first cluster listed.
- Sites using the `cdn` option never had the token in their URLs.

If you ever deployed uploadfs with a SAS token in `replicateClusters`, revoke or rotate that token.

Thanks to [Kimi Security Team](https://github.com/KimiSecurityTeam) for reporting the vulnerability.
