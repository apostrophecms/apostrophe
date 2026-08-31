---
"apostrophe": minor
---

Added the `{% field %}` custom tag, which outputs one schema field of a document, widget, array item or object and lets the user edit it in place, right where it appears on the page:

```njk
{% field data.page, 'headline' with { tag: 'h1', class: 'article__headline' } %}
{% field data.page, 'body' %}
{% for section in data.page.sections %}
  {% field section, 'caption' with { tag: 'h2' } %}
{% endfor %}
```

If the field is an area, `{% field %}` is exactly `{% area %}`: same markup, same editor, same `with` clause. Otherwise the field type must offer an on-page editor, which today means `richText` and `string`. Any other type throws an exception naming the field and its type, rather than displaying something the user cannot edit.

A single line string is rendered inline and edited inline. `Name: {% field data.page, 'name' %}` keeps its place on the line when the editor arrives, in a box no wider than the text, rather than becoming a block of its own and pushing the rest of the line down. The tag is chosen by the field type, which knows what shape its value is: a `string` is a `span`, a `string` with `textarea: true` is a `div`, and so is rich text. Nothing is printed after the closing tag either, not even a newline, so a field can be followed immediately by a full stop.

The editor asks the browser what the site's own CSS made of the tag rather than reading the tag name, so a `span` a stylesheet turned into a block is treated as one. A value too long for the room left on the line does begin on the next line, as any wide inline object does, since text cannot flow around the box you type in.

Outside of edit mode nothing but the value is rendered, so the tag is safe to use on any page: rich text renders as it does in a widget, permalinks and all, and a string is escaped as text, with the line breaks of a `textarea: true` string preserved. In edit mode the editor is mounted in place, styled to inherit the page's own typography so that editing feels like typing on the page rather than filling in a form, and taking up no more room than the markup it replaced, so that nothing on the page moves when editing begins. A `string` field grows as you type; a single line string refuses line breaks and collapses pasted ones. The editors save exactly as an area on the page does, patching one field at a time through the context bar, and they emit `update:modelValue` and `changed` when a component uses them elsewhere. Read only fields, and fields of a document other than the one the page is about, are displayed but not editable, again just like an area.

Coming near a field outlines it and raises the same breadcrumb trail a widget has, so the user can see what they are about to edit, and can find out that they can edit it at all. The trail is built the way a widget builds its own, by walking up the page, so a field of a widget is preceded by that widget and by whatever contains it, and clicking a crumb focuses that widget. It opens with an icon for the field type, which a field type sets with `wysiwygIcon` and an individual field can override with a `wysiwygIcon` property of its own.

Exactly one trail is ever on screen. A field takes the trail from the widget it belongs to, since its own trail already names that widget, and the field being edited keeps the trail while the mouse passes over anything else, which is how widgets have always behaved among themselves.

The `with` clause accepts `tag`, which overrides the tag the field type chose, plus `class`, `style`, `attrs`, and `edit: false` to render a field that is never editable in place. When the field is an area, `with` means what it means for `{% area %}`.

Field types opt in with a `wysiwyg` property, and can customize the rest:

- `wysiwyg: true` — this type can be edited in place.
- `wysiwygComponent` — the editor component, `AposWysiwygInput` plus the capitalized type name by convention.
- `wysiwygRender(req, field, value)` — the markup for the value; escaped text by default.
- `wysiwygTag(field)` — the tag the value is rendered as when the template does not say, `div` by default. Given the field, so that one type can answer differently depending on how it is configured, as `string` does.
- `wysiwygModifiers(field)` — extra `apos-wysiwyg-field--*` classes, so that one type can be styled differently depending on how it is configured.
- `wysiwygIcon` — the icon that opens the breadcrumb trail, `pencil-icon` by default.

A field of an array item or an object is patched by its own `@id.fieldName` key, so editing one caption of one item leaves the rest of the document alone, just as editing one field of a widget does.

Supporting changes, useful on their own: `apos.area.renderAreaTag()` and `apos.schema.renderFieldTag()` carry out the work of the two tags, so either can be invoked directly, and the `with` clause is now parsed by one shared implementation. The breadcrumb trail is now defined once, as a set of SCSS mixins in `@apostrophecms/ui`, and included by both the widget trail and the field trail, so the two cannot drift apart. Which trail is on screen is decided in one place as well: the widget store answers with `labeled`, and a widget asks it rather than working the question out for itself, which is what keeps two trails from ever appearing at once. `AposRichTextEditor` accepts an `inline` prop, which drops the padding, the empty-state block, the inter-block spacing, the size containment and the widget `className` that the editor wears in a widget or a modal, none of which belong on a field the editor is standing in for.
