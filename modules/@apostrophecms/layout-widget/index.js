module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'apostrophe:layout',
    steps: 12,
    minSpan: 1,
    defaultSpan: 4,
    mobile: {
      breakpoint: 480
    },
    tablet: {
      breakpoint: 1024
    }
  },
  fields: {
    add: {
      columns: {
        type: 'area',
        options: {
          editorComponent: 'AposAreaLayoutEditor',
          widgetTemplate: '@apostrophecms/layout-widget:column.html',
          widgets: {
            '@apostrophecms/layout-column': {}
          }
        }
      }
    }
  },
  extendMethods(self) {
    return {
      getBrowserData(_super, req) {
        const result = _super(req);
        return {
          ...result,
          grid: {
            steps: self.options.steps,
            minSpan: self.options.minSpan,
            defaultSpan: self.options.defaultSpan,
            mobile: self.options.mobile,
            tablet: self.options.tablet
          }
        };
      }
    };
  }
};
