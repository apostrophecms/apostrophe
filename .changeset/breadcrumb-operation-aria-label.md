---
"apostrophe": patch
---

Fixed icon-only widget breadcrumb operations, such as the Styles button on a layout column, being announced by screen readers as "Provide a Button Label". These buttons now take their accessible name from the operation's `label`, or from its `tooltip` when no label is set. This also covers breadcrumb operations added by project code.
