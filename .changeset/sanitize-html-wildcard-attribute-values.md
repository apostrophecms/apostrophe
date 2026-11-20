---
"sanitize-html": patch
---

Value rules in `allowedAttributes` (`{ name, values, multiple }`) listed under the `*` wildcard now apply to every tag. Before, such an attribute was always removed. When the tag and `*` both have a rule for the same attribute, a value that either rule allows is kept.
