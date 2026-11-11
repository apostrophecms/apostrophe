# Example: checkbox field with a rich text label

This example adds a new form field type to a project: a checkbox whose label is rich text. Editors can put links in the label, for example "I accept the [privacy policy](#)".

It is a **project-level** customization. You do not change or fork `@apostrophecms/form`.

- Existing forms and checkbox fields keep working. No migration is needed.
- Editors use the new field type where they need a link. To change an existing checkbox, they replace it with the new field type.

## Files

Copy these into your project, at the same paths:

| File | Purpose |
|---|---|
| `modules/rich-text-boolean-field-widget/index.js` | The new field type. It extends the built-in checkbox field and adds a rich text label. |
| `modules/rich-text-boolean-field-widget/views/widget.html` | Front-end markup for the field. |
| `modules/rich-text-boolean-field-widget/ui/src/index.scss` | Puts the checkbox and its label side by side. |
| `modules/@apostrophecms/form/index.js` | Adds the new field type to the list editors can choose from. |

`app.js` in this folder is an excerpt. It shows the one line to add to your own `app.js`.

## Setup

1. Copy the `rich-text-boolean-field-widget` module folder into your project's `modules/` folder.
2. Register it in `app.js`:

   ```javascript
   modules: {
     // ...your existing form modules
     'rich-text-boolean-field-widget': {}
   }
   ```

3. Add `'rich-text-boolean-field': {}` to the `formWidgets` option of `@apostrophecms/form`.
   - If your project already has `modules/@apostrophecms/form/index.js` with a `formWidgets` option, add that one line to it.
   - If it does not, copy the file from this example. `formWidgets` replaces the default list, so the example file repeats the defaults.

4. Restart the site so the new front-end styles are built.

The modules use ES module syntax (`export default`). If your project uses CommonJS, change `export default {` to `module.exports = {`.

## How editors use it

1. Open a form and add a field. Choose **Checkbox with rich text label**.
2. In **Label shown to visitors**, type the text. Select the words to link and use the link button. Links can point to a page on the site or to an external URL.
3. Fill in **Field label (plain text)**. This builds the field name and identifies the field in submissions and emails. Visitors do not see it.
4. Set **Required** if visitors must tick the box to submit.

If the rich text label is left empty, the field shows the plain-text label instead.

## How it works

The new module extends `@apostrophecms/form-boolean-field-widget`, so it reuses everything the built-in checkbox does:

- **Saving submissions:** the value is stored as `true` or `false` under the field name, the same as a regular checkbox.
- **Required check:** a required box must be ticked, or the submission is rejected with the usual error message.
- **Conditional groups:** the field can control a conditional group, and it can be placed inside one.
- **Front-end JavaScript:** none is needed. The template keeps the `data-apos-form-boolean` attribute, so the built-in checkbox code collects its value.

The only new parts are the `richLabel` area field and the template.

### Accessibility

Rich text renders block elements (`<div>`, `<p>`), and these are not valid inside a `<label>` element. The template names the checkbox with `aria-labelledby` instead, so screen readers read the rich text as the checkbox's label.

One difference from a regular checkbox: clicking the label text does not tick the box. Visitors tick the box itself. This also means clicking the privacy policy link never ticks the box by accident.

### Changing an existing checkbox

Editors can replace an existing checkbox with the new field type. If they give it the same plain-text label, and therefore the same field name, new submissions use the same key as old ones. Submission exports and emails stay consistent.

## Customizing

- **Toolbar:** the label allows bold, italic and links. Change `toolbar` in `richLabel` in `index.js` to allow more or less.
- **Admin UI labels:** the labels and help text are plain English strings. To translate them, replace them with i18n keys from your project's translation files.
- **Styles:** adjust `ui/src/index.scss`. If you set the form module's `classPrefix` option, the template adds your prefixed classes as well, the same way the built-in fields do.
