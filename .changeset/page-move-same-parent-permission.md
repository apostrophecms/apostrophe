---
"apostrophe": patch
---

Security: reordering a page among its siblings under the same parent now requires permission to create pages under that parent, just like moving a page to a new parent or inserting a page there. Previously that check only applied when a page moved to a different parent. As a result, a user who could edit one page nested under a restricted parent (for example a page type with `editRole: 'admin'`) could reorder it and so change the rank, and therefore the navigation order, of that parent's other children, which they had no permission to edit. Reordering within the archive is still allowed (CWE-862, GHSA-2jrp-qc93-h2j8).

Thanks to [Daniel Coles](https://github.com/manus-pi) for responsibly reporting the vulnerability.
