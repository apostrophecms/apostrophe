---
"apostrophe": patch
---

Faster page rendering, especially with an external front such as Astro. The ids that scope each widget's styles are now cheap random ids instead of `apos.util.generateId()` (cuid2), which cost about 120µs per widget on every render. When page data is sent to an external front, each object is now annotated once, even though `page` contains its own `_ancestors` and `_children` and, below the home page, `home` is `_ancestors[0]`; previously these were annotated two or three times. In production, when the release id comes from a `release-id` file, the project path or git rather than an environment variable, it is now worked out once rather than on every request, which previously ran `git rev-parse` several times per page when falling back to git.
