---
"@apostrophecms/cli": patch
---

Security: bump and clean up dependencies. This closes vulnerabilities in `uuid` and `fast-xml-parser` although they were not used in a sensitive or vulnerable way within ApostropheCMS. This also closes a vulnerability in `shelljs` which ould only be exploited if the developer could be convinced to enter malicious commands as part of their CLI input.
