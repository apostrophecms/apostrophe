---
"@apostrophecms/apostrophe-astro": minor
---

Added the `AposField` component, which displays one schema field of a document, widget, array item or object and lets the user edit it right where it appears on the page, the way `AposArea` does for areas:

```jsx
<AposField doc={page} name="title" tag="h1" class="article__headline" />
```

The value is rendered by Apostrophe, so rich text arrives with its permalinks resolved and a string arrives escaped, and a field type added by a module renders as that module says. A single line string is inline: `Name: <AposField doc={person} name="name" />.` keeps its place on the line, and its full stop, when the editor arrives.

`tag` overrides the tag the field type chose, `class` is added to the classes it asks for rather than replacing them, `style` and `attrs` are passed through, `edit={false}` never offers editing, and any other prop reaches the editor as its options.

Apostrophe only sends the information for fields that ask for it, with `wysiwyg: true` on the field or the `wysiwygFields` option of the module, since it cannot tell from the data which fields a template renders in place. While developing, `AposField` writes a note to the terminal when it displays a field that did not ask, naming the field and the option to set. A field that was not annotated is still displayed, just not editable, so a page never breaks over it.
