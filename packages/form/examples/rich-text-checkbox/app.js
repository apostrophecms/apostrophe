// Excerpt of a project's app.js. Only the form-related modules are shown.
// Register the new widget module next to the form modules you already have.
import apostrophe from 'apostrophe';

apostrophe({
  root: import.meta,
  shortName: 'my-project',
  modules: {
    // The form bundle, as in any project that uses forms
    '@apostrophecms/form': {},
    '@apostrophecms/form-widget': {},
    '@apostrophecms/form-text-field-widget': {},
    '@apostrophecms/form-textarea-field-widget': {},
    '@apostrophecms/form-select-field-widget': {},
    '@apostrophecms/form-radio-field-widget': {},
    '@apostrophecms/form-file-field-widget': {},
    '@apostrophecms/form-checkboxes-field-widget': {},
    '@apostrophecms/form-boolean-field-widget': {},
    '@apostrophecms/form-conditional-widget': {},
    '@apostrophecms/form-divider-widget': {},

    // New: the checkbox field with a rich text label
    'rich-text-boolean-field-widget': {}
  }
});
