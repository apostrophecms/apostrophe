module.exports = {
  extend: '@apostrophecms/form-select-field-widget',
  options: {
    label: 'aposForm:radio',
    icon: 'radiobox-marked-icon'
  },
  icons: {
    'radiobox-marked-icon': 'RadioboxMarked'
  },
  fields: {
    add: {
      choices: {
        label: 'aposForm:radioChoice',
        type: 'array',
        titleField: 'label',
        required: true,
        min: 1, // Two would be better, but this is primarily to avoid errors.
        fields: {
          add: {
            label: {
              type: 'string',
              required: true,
              label: 'aposForm:checkboxChoicesLabel',
              help: 'aposForm:checkboxChoicesLabelHelp'
            },
            value: {
              type: 'string',
              label: 'aposForm:checkboxChoicesValue',
              help: 'aposForm:checkboxChoicesValueHelp'
            }
          }
        }
      }
    }
  }
};
