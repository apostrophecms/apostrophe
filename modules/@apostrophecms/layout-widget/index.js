module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'apostrophe:layout',
    initialModal: false,
    skipOperations: [ 'edit' ],
    columns: 12,
    minSpan: 2,
    defaultSpan: 4,
    mobile: {
      breakpoint: 600
    },
    tablet: {
      breakpoint: 1024
    },
    gap: 0,
    defaultCellHorizontalAlignment: null,
    defaultCellVerticalAlignment: null
  },
  fields(self, options) {
    return {
      add: {
        columns: {
          type: 'area',
          options: {
            // Custom editor component for layout management
            editorComponent: 'AposAreaLayoutEditor',
            // Default widget template for columns so that grid items
            // are direct descendants of the grid container
            widgetTemplate: '@apostrophecms/layout-widget:column.html',
            widgets: {
              '@apostrophecms/layout-column': {},
              '@apostrophecms/layout-meta': {}
            }
          }
        }
      }
    };
  },
  extendMethods(self) {
    return {
      getBrowserData(_super, req) {
        const result = _super(req);
        return {
          ...result,
          grid: {
            columns: self.options.columns,
            minSpan: self.options.minSpan,
            defaultSpan: self.options.defaultSpan,
            mobile: self.options.mobile,
            tablet: self.options.tablet,
            gap: self.options.gap,
            defaultCellHorizontalAlignment: self.options.defaultCellHorizontalAlignment,
            defaultCellVerticalAlignment: self.options.defaultCellVerticalAlignment
          }
        };
      }
    };
  },
  helpers(self) {
    return {
      getLayoutMeta(widget) {
        return widget?.columns?.items?.find(item => item.type === '@apostrophecms/layout-meta');
      }
    };
  }
};
