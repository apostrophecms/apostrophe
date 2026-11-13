---
"@apostrophecms/ai-helper": patch
---

Security: the rich text AI helper route used the requested heading levels without checking their range, so a very large value made the server build and return an enormous response, tying up the process. Only valid HTML heading levels (1 through 6) are now accepted, and anything else is ignored. Exploitation required a logged-in user with edit permission for at least one content type (CWE-400, CWE-1284, GHSA-f49h-mhf2-fxmg).

Thanks to [N Manoj Kumar](https://github.com/DarkFightermanu) for reporting the vulnerability.
