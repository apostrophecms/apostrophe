module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'aposForm:widgetForm',
    icon: 'form-select-icon'
  },
  icons: {
    'form-select-icon': 'FormSelect'
  },
  fields: {
    add: {
      _form: {
        label: 'aposForm:widgetFormSelect',
        type: 'relationship',
        withType: '@apostrophecms/form',
        required: true,
        max: 1
      }
    }
  },
  extendMethods (self) {
    return {
      load(_super, req, widgets) {
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
