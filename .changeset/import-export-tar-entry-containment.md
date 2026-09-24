---
"@apostrophecms/import-export": patch
---

Security: when extracting an uploaded gzip archive, the check meant to keep tar entries inside the extraction directory only looked for a literal `../` in each entry name, so names such as `..` or `./..` still pointed outside of it. Entry paths are now resolved and must land strictly inside the extraction directory (absolute names are skipped too), and a failed write now fails the import cleanly and stops reading the archive rather than risking an unhandled error that stops the process (CWE-22, GHSA-97wv-p4xx-c7mg).

Thanks to [Arpit Jain](https://github.com/arpitjain099) for responsibly reporting the vulnerability.
