---
"apostrophe": patch
---

Fixed a security hole in the `.choices()` and `.counts()` query builders: formerly, these query builders could be used
by the public to exfiltrate schema fields not included in the `publicApiProjection`, or fields locked down with
a `viewPermission` property. Thanks to [offset](https://github.com/offset) for reporting this issue, which was not
made public prior to the release of the fix.
