// The JSX version of `wysiwygField.html`, used when the `jsx` option of
// @apostrophecms/template is set: one field rendered in place, with what
// the editor needs when the user is editing. See the `{% field %}` tag.
// Nothing may come between the tags and the value, since a field can be
// inline content.

import { jsonAttribute } from '../../template/lib/jsxFilters.js';

export default function ({
  tag, classes, canEdit, docId, patchKey, component, icon, fieldId,
  valueJson, rendered, _with
}, { apos }) {
  const Tag = tag;
  const attrs = { className: classes ?? '' };
  if (canEdit) {
    Object.assign(attrs, {
      'data-apos-wysiwyg-field-newly-editable': true,
      'data-doc-id': docId ?? '',
      'data-patch-key': patchKey ?? '',
      'data-component': component ?? '',
      'data-icon': icon ?? '',
      'data-field-id': fieldId ?? '',
      'data-value': jsonAttribute(valueJson),
      'data-options': jsonAttribute(_with)
    });
  }
  if (_with?.style) {
    attrs.style = _with.style;
  }
  for (const [ key, value ] of Object.entries(_with?.attrs || {})) {
    attrs[key] = value ?? '';
  }
  return <Tag {...attrs}>{apos.template.safe(rendered ?? '')}</Tag>;
}
