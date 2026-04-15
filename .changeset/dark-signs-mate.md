---
"apostrophe": minor
---

Fix edge case where widgets having styles and fields at the same time would show "Ungrouped" tab. Add `hideSingleTab` option that can be enabled in any widget to hide tabs from the widget editor when there is only one tab containing fields. This option can also be enabled globally in `@apostrophecms/widget-type` options.
