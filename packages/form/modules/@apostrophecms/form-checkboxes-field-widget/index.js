module.exports = {
  extend: '@apostrophecms/form-base-field-widget',
  options: {
    label: 'aposForm:checkbox',
    icon: 'checkbox-marked-outline-icon'
  },
  icons: {
    'checkbox-marked-outline-icon': 'CheckboxMarkedOutline'
  },
  fields: {
    add: {
      choices: {
        label: 'aposForm:checkboxChoices',
        type: 'array',
        titleField: 'label',
        required: true,
        min: 1, // Two would be better, but this is primarily to avoid errors.
        fields: {
          add: {
            label: {
              label: 'aposForm:checkboxChoicesLabel',
              type: 'string',
              required: true,
              help: 'aposForm:checkboxChoicesLabelHelp'
            },
            value: {
              label: 'aposForm:checkboxChoicesValue',
              type: 'string',
              help: 'aposForm:checkboxChoicesValueHelp'
            }
          }
        }
      }
    }
  },
  methods (self) {
    return {
      sanitizeFormField (widget, input, output) {
      // Get the options from that form for the widget
        const choices = self.getChoicesValues(widget);

        if (!input[widget.fieldName]) {
          output[widget.fieldName] = null;
          return;
        }

        input[widget.fieldName] = Array.isArray(input[widget.fieldName])
          ? input[widget.fieldName]
          : [];

        // Return an array of selected choices as the output.
        output[widget.fieldName] = input[widget.fieldName]
          .map(choice => {
            return self.apos.launder.select(choice, choices);
          })
          .filter(choice => {
          // Filter out the undefined, laundered out values.
            return choice;
          });
      }
    };
  }
};
