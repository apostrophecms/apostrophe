module.exports = {
  extend: '@apostrophecms/form-base-field-widget',
  options: {
    label: 'aposForm:text',
    icon: 'form-textbox-icon'
  },
  icons: {
    'form-textbox-icon': 'FormTextbox'
  },
  fields: {
    add: {
      inputType: {
        label: 'aposForm:textType',
        type: 'select',
        help: 'aposForm:textTypeHelp',
        choices: [
          {
            label: 'aposForm:textTypeText',
            value: 'text'
          },
          {
            label: 'aposForm:textTypeEmail',
            value: 'email'
          },
          {
            label: 'aposForm:textTypePhone',
            value: 'tel'
          },
          {
            label: 'aposForm:textTypeUrl',
            value: 'url'
          },
          {
            label: 'aposForm:textTypeDate',
            value: 'date'
          },
          {
            label: 'aposForm:textTypePassword',
            value: 'password'
          }
        ],
        def: 'text'
      },
      placeholder: {
        label: 'aposForm:textPlaceholder',
        type: 'string',
        help: 'aposForm:textPlaceholderHelp'
      }
    }
  },
  methods (self) {
    return {
      sanitizeFormField (widget, input, output) {
        output[widget.fieldName] = self.apos.launder.string(input[widget.fieldName]);
      }
    };
  }
};
