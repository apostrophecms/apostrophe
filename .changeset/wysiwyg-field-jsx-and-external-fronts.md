---
"apostrophe": minor
---

Fields can now be edited in place from JSX templates and from external fronts such as Astro, not only from Nunjucks.

JSX templates get a `Field` helper alongside `Area`, which is the `{% field %}` tag with the same `with` clause:

```jsx
export default function ({ page }, { Field, Area }) {
  return <article>
    <Field doc={page} name='headline' with={{ tag: 'h1', class: 'article__headline' }} />
    <Area area={page.main} />
  </article>;
}
```

External fronts are sent what it takes to display a field and edit it, under `_wysiwygFields` on the document, widget, array item or object the field belongs to. `@apostrophecms/apostrophe-astro` renders that with its own `AposField` component.

When using Astro, a non-area field must be explicitly declared as WYSIWYG. Do that by setting `wysiwyg: true` when declaring the field, or add it to the `wysiwygFields` array option of the relevant module, whichever is convenient. A name in `wysiwygFields` that is not in the schema throws at startup. Nunjucks and JSX need no such flag: they run inside Apostrophe and work everything out when the template reaches the field. An external front receives its data before its templates run, so it has to say in advance, and a page carries dozens of fields no template renders in place — every SEO field, every Open Graph field, every slug, on the page, its ancestors, its children and any pieces alongside them. On a demo site, annotating all of them added 70% to the response.

A visitor who cannot edit a field is sent only what it takes to display it, so a page served to the public carries no editors to mount, no icons and no patch keys.

A field rendered in place now names its definition with `data-field-id` instead of carrying a copy of it in `data-field`. Every doc type and widget type already ships its schema to the browser, so a page with fifty fields of one type no longer repeats that type's definition of them fifty times. The definition is looked up in that schema when the editor mounts; a field held back by `allowedSchema` is not there, so the value stays where it is, displayed and not editable, exactly as it is for a user who cannot edit it.

Supporting change, useful on its own: `apos.schema.wysiwygFieldData(req, object, field, with)` returns everything needed to render a field in place and edit it. `renderWysiwygField` renders from it, and the external front annotation is built from it, so the two cannot drift apart.
