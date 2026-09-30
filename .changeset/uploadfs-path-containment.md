---
"uploadfs": patch
---

Security: uploadfs did not validate the paths passed to its methods, so an application that passed an untrusted path to `copyIn`, `copyOut`, `streamOut`, `remove`, `enable` or `disable` could read, write, delete or change the permissions of files outside the uploads folder when using the local backend. Apostrophe itself builds these paths from generated ids and sanitized file names, but uploadfs now enforces this on its own: paths containing `..` segments are refused with an error for every backend (this also stops keys that cloud SDKs would normalize into another bucket or container), and the local backend additionally verifies that every filesystem path it touches resolves to a location inside `uploadsPath` (CWE-22, GHSA-gmfx-5g6x-rr72).

Thanks to [loulu1ou](https://github.com/loulu1ou) for reporting the vulnerability.
