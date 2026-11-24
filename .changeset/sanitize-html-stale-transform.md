---
"sanitize-html": patch
---

When `transformTags` renamed a tag to one that is not allowed, the discarded tag left its new name behind, and the next element closed at the same depth was written with that name. For example, a transform that turns links without an `href` into `span` produced `<a href="…">link</span>` for a following link. Each closing tag now uses only its own transformed name.
