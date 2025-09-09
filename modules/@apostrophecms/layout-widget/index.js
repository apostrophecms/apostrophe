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
  widgetOperations(self, options) {
    return {
      add: {
        layout: {
          placement: 'breadcrumb',
          type: 'switch',
          choices: [
            {
              label: 'Content',
              value: 'content'
            },
            {
              label: 'Layout',
              value: 'layout'
            }
          ],
          def: 'content'
        },
        layoutHelp: {
          placement: 'breadcrumb',
          type: 'info',
          icon: 'information-outline-icon',
          tooltip: 'apostrophe:layoutTogggleTooltip'
        }
      }
    };
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
      },
      detectLastTabletFullWidthItem(widgets) {
        if (!Array.isArray(widgets)) {
          return;
        }
        const meta = widgets.find(widget => widget.type === '@apostrophecms/layout-meta');
        if (!meta?.tablet?.auto) {
          return;
        }
        const items = widgets.filter(widget => widget.type !== '@apostrophecms/layout-meta');
        if (items.length % 2 === 0) {
          return;
        }
        items.sort((a, b) =>
          (a.tablet.order || a.desktop.order) - (b.tablet.order || b.desktop.order)
        );
        return items[items.length - 1]._id;
      }
    };
  }
};
