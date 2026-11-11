// A checkbox form field whose visible label is rich text, so editors can
// include links (for example, "I accept the privacy policy").
//
// It extends the built-in checkbox field, so it inherits:
// - the `fieldLabel`, `fieldName`, `required` and `checked` fields
// - server-side sanitizing and the required check
// - the browser-side value collector and conditional logic, because the
//   template keeps the `data-apos-form-boolean` attribute
//
// Existing checkbox fields are not changed. Editors add this field type
// where they need a link in the label.
export default {
  extend: '@apostrophecms/form-boolean-field-widget',
  options: {
    label: 'Checkbox with rich text label',
    icon: 'toggle-switch-outline-icon'
  },
  fields: {
    add: {
      // Keep the plain-text label. It builds the field name and is what
      // editors see in submissions, so it stays required. We only change
      // its label and help text to explain its role.
      fieldLabel: {
        label: 'Field label (plain text)',
        help: 'Used to build the field name and to identify this field in submissions. Visitors see the rich text label below.',
        type: 'string',
        required: true
      },
      richLabel: {
        label: 'Label shown to visitors',
        help: 'Use the link button to link to a page, such as your privacy policy.',
        type: 'area',
        options: {
          max: 1,
          widgets: {
            '@apostrophecms/rich-text': {
              toolbar: [ 'bold', 'italic', 'link' ],
              insert: []
            }
          }
        }
      }
    },
    group: {
      basics: {
        label: 'Basics',
        fields: [ 'richLabel', 'fieldLabel', 'fieldName', 'required', 'checked' ]
      }
    }
  }
};
