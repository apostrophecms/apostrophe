module.exports = {
  extend: '@apostrophecms/form-base-field-widget',
  options: {
    label: 'aposForm:select',
    icon: 'form-select-icon',
    allowMultiple: false
  },
  fields(self) {
    const optionalFields = self.options.allowMultiple
      ? {
        allowMultiple: {
          label: 'aposForm:selectAllowMultiple',
          type: 'boolean',
          def: false
        },
        size: {
          label: 'aposForm:selectSize',
          type: 'integer',
          def: 0,
          min: 0,
          if: {
            allowMultiple: true
          }
        }
      }
      : {};

    return {
      add: {
        choices: {
          label: 'aposForm:selectChoice',
          type: 'array',
          titleField: 'label',
          required: true,
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
        },
        ...optionalFields
      }
    };
  },
  methods (self) {
    return {
      sanitizeFormField (widget, input, output) {
        // Get the options from that form for the widget
        const choices = self.getChoicesValues(widget);

        output[widget.fieldName] =
        self.apos.launder.select(input[widget.fieldName], choices);
      }
    };
  },
  extendMethods (self) {
    return {
      async output(_super, req, widget, options, _with) {
        return _super(
          req,
          {
            ...widget,
            allowMultiple: (self.options.allowMultiple && widget.allowMultiple) ?? false,
            size: widget.size ?? 0
          },
          options,
          _with
        );
      }
    };
  }
};
