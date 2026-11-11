// Project-level configuration of the form module.
//
// `formWidgets` replaces the default list of field types, so it repeats the
// defaults and adds the new rich text checkbox field. If your project already
// sets `formWidgets`, add only the `rich-text-boolean-field` line to it.
//
// Conditional groups reuse this list, so the new field also works inside them.
export default {
  options: {
    formWidgets: {
      '@apostrophecms/form-text-field': {},
      '@apostrophecms/form-textarea-field': {},
      '@apostrophecms/form-boolean-field': {},
      // The new field type. The name is the module name without "-widget".
      'rich-text-boolean-field': {},
      '@apostrophecms/form-select-field': {},
      '@apostrophecms/form-radio-field': {},
      '@apostrophecms/form-checkboxes-field': {},
      '@apostrophecms/form-conditional': {},
      '@apostrophecms/form-divider': {},
      '@apostrophecms/rich-text': {
        toolbar: [
          'styles', 'bold', 'italic', 'link',
          'orderedList', 'bulletList'
        ]
      }
    }
  }
};
