module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'aposForm:baseWidget'
  },
  fields: {
    add: {
      fieldLabel: {
        label: 'aposForm:fieldLabel',
        type: 'string',
        required: true
      },
      required: {
        label: 'aposForm:fieldRequired',
        type: 'boolean'
      },
      fieldName: {
        label: 'aposForm:fieldName',
        type: 'slug',
        following: [ 'fieldLabel' ],
        help: 'aposForm:fieldNameHelp'
      }
    }
  },
  methods (self) {
    return {
      checkRequired (req, widget, input) {
        if (widget.required && !input[widget.fieldName]) {
          throw self.apos.error('invalid', {
            fieldError: {
              field: widget.fieldName,
              error: 'required',
              message: req.t('aposForm:requiredError')
            }
          });
        }
      },
      getChoicesValues (widget) {
        if (!widget || !widget.choices) {
          return [];
        }

        return widget.choices.map(choice => {
          return choice.value;
        });
      }
    };
  },
  extendMethods (self) {
    return {
      sanitize (_super, req, input, options) {
        if (!input.fieldName) {
          input.fieldName = self.apos.util.slugify(input.fieldLabel);
        }

        // If no option value entered, use the option label for the value.
        if (Array.isArray(input.choices)) {
          input.choices.forEach(choice => {
            if (!choice.value) {
              choice.value = choice.label;
            }
          });
        }

        return _super(req, input, options);
      },
      load (_super, req, widgets) {
        const formModule = self.apos.modules['@apostrophecms/form'];
        const classPrefix = formModule.options.classPrefix;

        if (classPrefix) {
          widgets.forEach(widget => {
            widget.classPrefix = classPrefix;
          });
        }

        return _super(req, widgets);
      }
    };
  }
};
