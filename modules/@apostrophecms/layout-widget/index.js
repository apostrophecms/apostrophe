module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'apostrophe:layout',
    columns: 12,
    minSpan: 1,
    defaultSpan: 4,
    mobile: {
      breakpoint: 480
    },
    tablet: {
      breakpoint: 1024
    },
    gap: 0,
    defaultGridHorizontalAlignment: null,
    defaultGridVerticalAlignment: null,
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
            defaultGridHorizontalAlignment: self.options.defaultGridHorizontalAlignment,
            defaultGridVerticalAlignment: self.options.defaultGridVerticalAlignment,
            defaultCellHorizontalAlignment: self.options.defaultCellHorizontalAlignment,
            defaultCellVerticalAlignment: self.options.defaultCellVerticalAlignment
          }
        };
      }
    };
  }
};
