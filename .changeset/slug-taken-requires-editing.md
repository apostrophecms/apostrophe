---
"apostrophe": patch
---

Security: the `slug-taken` route of `@apostrophecms/doc` told any logged-in user, including guests who cannot edit anything, whether a slug was in use, even by documents they could not view. It now requires the ability to edit content (the `view-draft` permission held by contributors, editors and admins). Because slugs are unique across all documents, users who can choose a slug still learn that it is already taken; this is inherent in globally unique slugs, and the route reveals nothing about the document beyond that (CWE-200, CWE-203, GHSA-f66c-mpj2-3r8h).

Thanks to [T.Jaswanth](https://github.com/Jaswanth080901) for reporting the vulnerability.
