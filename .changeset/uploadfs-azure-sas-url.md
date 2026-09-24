---
"uploadfs": patch
---

Security: when the Azure backend was configured with a SAS token (`sas: true`), `getUrl()` returned a base URL that still carried the SAS token as its query string, so the credential was included in every public attachment URL, and the file path was appended after the query string, producing broken URLs. `getUrl()` now strips the query string from the container URL, so public URLs contain no credentials and are well formed. The top-level `sas` option is now also honored when `replicateClusters` is not used, as documented (CWE-522, CWE-200, GHSA-hhph-8536-gfq5).

Thanks to [Kimi Security Team](https://github.com/KimiSecurityTeam) for reporting the vulnerability.
