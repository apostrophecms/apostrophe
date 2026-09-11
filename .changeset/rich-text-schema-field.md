---
"apostrophe": minor
---

Added a `richText` schema field type, so rich text is no longer available only as a widget in an area. A `richText` field is edited with the same editor, sanitized with the same rules, and indexed for search the same way as the content of a rich text widget.

```javascript
fields: {
  add: {
    body: {
      label: 'Body',
      type: 'richText',
      // Exactly the options a rich text widget accepts in an area,
      // merged over the `defaultOptions` of `@apostrophecms/rich-text-widget`
      options: {
        toolbar: [ 'styles', 'bold', 'italic', 'link' ],
        styles: [
          { tag: 'p', label: 'Paragraph' },
          { tag: 'h3', label: 'Heading 3' }
        ]
      }
    }
  }
}
```

The behavior of rich text is still configured in exactly one place, the `@apostrophecms/rich-text-widget` module: its `defaultOptions`, its `tools`, and its methods govern `richText` fields too, so an existing project that has customized rich text gets the same customizations in schema fields without doing anything. To support this, the editor itself was factored out of `AposRichTextWidgetEditor.vue` into a new, reusable `AposRichTextEditor.vue`, which both the widget editor and the new `AposInputRichText.vue` field instantiate. The widget editor keeps its name, its props, its events and its markup, and continues to accept per-area editor options, so nothing changes for existing rich text widgets or for projects that have overridden either component.

Permalinks are stored as placeholders in a `richText` field, just as they are in a rich text widget. Widgets replace them with real URLs when they are rendered; a schema field has no render-time hook of its own, unless you are using `{% field %}` (or `Field` in JSX, or `AposField` in Astro). If you want a `richText` field but don't want to place it on the page in a WYSIWYG way, call `apos.modules['@apostrophecms/rich-text-widget'].renderRichText(req, html)` on the markup.
