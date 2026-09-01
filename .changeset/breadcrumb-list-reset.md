---
"apostrophe": patch
---

Fixed the breadcrumb trail of a widget or of a field edited in place picking up the site's own list styling. The trail is an `<ol>` of `<li>` elements rendered inside the page, so a rule as ordinary as `.features li::before { content: '✓' }` put a checkmark on every crumb when the thing being edited was inside that list. Crumbs now refuse markers and generated content, while the site's own list items keep theirs.
