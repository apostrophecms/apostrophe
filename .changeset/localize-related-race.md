---
"apostrophe": patch
---

Fixed a bug where changing a setting in the Localize dialog right after opening it could make the option to localize related documents, such as images, disappear, so that only the document itself was localized. The dialog now waits until it has finished loading before accepting changes.
