---
"@apostrophecms/import-export": patch
---

Security: the `clean-export` and `override-duplicates` routes did not require a login. Also, `clean-export` would discard the pending files of an import started by someone else and mark any import job as completed, without checking who owned either. Both routes now require a logged-in user. `clean-export` only acts on an import uploaded by the caller, and only ends that caller's own job. Import jobs are now recorded as belonging to the user who started them. Exposure was limited because the pending import's ID is random and only shown to the user who uploaded it, so in practice an attacker could only interfere with an import they could already identify (CWE-306, CWE-862, CWE-639, GHSA-rw26-wwfc-9wvm).

Thanks to [Liuhuo Wan](https://github.com/CoSunshine) for reporting the vulnerability.
