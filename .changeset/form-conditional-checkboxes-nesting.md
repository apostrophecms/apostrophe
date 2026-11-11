---
"@apostrophecms/form": patch
---

Conditional fields now behave on the server as they do in the browser. A conditional triggered by a checkboxes field is kept when any checked value matches, where before it was always skipped because the answer is an array. Fields nested in a group inside a hidden conditional are skipped too, so their required checks no longer block the submission. Thanks to [Vlad Bisceanu](https://github.com/vladbisceanu) for the contribution.
