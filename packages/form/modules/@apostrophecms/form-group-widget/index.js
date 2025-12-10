module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'aposForm:group',
    className: 'apos-form-group',
    icon: 'file-multiple-outline-icon'
  },
  icons: {
    'file-multiple-outline-icon': 'FileMultipleOutline'
  },
  fields (self) {
    // Prevent nested groups
    const form = self.options.apos.modules['@apostrophecms/form'];
    const {
      '@apostrophecms/form-group': groupWidget,
      ...formWidgets
    } = form.fields.contents.options.widgets;

    return {
      add: {
        label: {
          label: 'aposForm:groupLabel',
          type: 'string',
          required: true
        },
        contents: {
          label: 'aposForm:groupContents',
          help: 'aposForm:groupContentsHelp',
          type: 'area',
          contextual: false,
          options: {
            widgets: formWidgets
          }
        }
      }
    };
  }
};
