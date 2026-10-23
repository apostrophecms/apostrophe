---
"apostrophe": minor
---

Widget operations can set `multiple: true` to be offered when several widgets are selected. A modal operation then receives `widgets`, an array of `{ widget, widgetSchema, widgetOptions }`, and an action receives `widgetIds`. Operations that do not set it work as before. Create widget operations (`apos.area.addCreateWidgetOperation`) may now resolve to an array of widgets, which are inserted in order as one undo step.
