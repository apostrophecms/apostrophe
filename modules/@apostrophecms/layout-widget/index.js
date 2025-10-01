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
    gap: '1.5rem',
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
  init(self) {
    self.metaWidgetName = '@apostrophecms/layout-meta';
    self.columnWidgetName = '@apostrophecms/layout-column';
  },
  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        validateAndIdentifyTypes() {
          const { meta, column } = self.validateAndIdentifyTypes();
          self.metaWidgetName = meta;
          self.columnWidgetName = column;
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
          },
          metaWidgetName: self.metaWidgetName,
          columnWidgetName: self.columnWidgetName
        };
      }
    };
  },
  methods(self) {
    return {
      validateAndIdentifyTypes() {
        if (self.options.columns < 2) {
          throw new Error('The layout widget must have at least 2 columns.');
        }
        if (self.options.minSpan < 1) {
          throw new Error('The layout widget must have a minimum span of at least 1.');
        }
        if (self.options.minSpan > self.options.columns) {
          throw new Error('The layout widget cannot have a minimum span greater than the number of columns.');
        }
        if (self.options.defaultSpan < self.options.minSpan) {
          throw new Error('The layout widget cannot have a default span less than the minimum span.');
        }
        if (self.options.defaultSpan > self.options.columns) {
          throw new Error('The layout widget cannot have a default span greater than the number of columns.');
        }

        const columnsField = self.schema.find(field => field.name === 'columns');
        if (!columnsField || columnsField.type !== 'area') {
          throw new Error('The layout widget must have a "columns" field of type "area".');
        }

        const widgetTypes = Object.keys(columnsField.options?.widgets || {});
        if (widgetTypes.length !== 2) {
          throw new Error(
            `The layout widget "columns" area must have exactly two widget types, it has ${widgetTypes.length}.`
          );
        }

        const check = {
          '@apostrophecms/layout-column': false,
          '@apostrophecms/layout-meta': false
        };
        const targetTypes = Object.keys(check);
        const targetModuleTypes = targetTypes.map(type => `${type}-widget`);
        for (const widgetType of widgetTypes) {
          if (targetTypes.includes(widgetType)) {
            check[widgetType] = widgetType;
            continue;
          }
          const type = `${widgetType}-widget`;
          const m = self.apos.modules[type];
          if (!m) {
            throw new Error(`The layout widget "columns" area has an unknown widget type: ${type}.`);
          }
          const meta = m.__meta.chain
            .find(item => targetModuleTypes.includes(item.name));
          if (meta) {
            const mappedType = targetTypes[targetModuleTypes.indexOf(meta.name)];
            check[mappedType] = widgetType;
            continue;
          }
        }
        if (!check['@apostrophecms/layout-column']) {
          throw new Error(
            'The layout widget "columns" area must have a widget type or a subtype of "@apostrophecms/layout-column"'
          );
        }

        if (!check['@apostrophecms/layout-meta']) {
          throw new Error(
            'The layout widget "columns" area must have a widget type or a subtype of "@apostrophecms/layout-meta"'
          );
        }

        if (!columnsField.options.editorComponent) {
          columnsField.options.editorComponent = 'AposAreaLayoutEditor';
        }
        if (!columnsField.options.widgetTemplate) {
          columnsField.options.widgetTemplate = '@apostrophecms/layout-widget:column.html';
        }

        return {
          meta: check['@apostrophecms/layout-meta'],
          column: check['@apostrophecms/layout-column']
        };
      }
    };
  },
  helpers(self) {
    return {
      getLayoutMeta(widget) {
        return widget?.columns?.items?.find(item => item.type === self.metaWidgetName);
      },
      detectLastTabletFullWidthItem(widgets) {
        if (!Array.isArray(widgets)) {
          return;
        }
        const meta = widgets.find(widget => widget.type === self.metaWidgetName);
        if (!meta?.tablet?.auto) {
          return;
        }
        const items = widgets.filter(widget => widget.type === self.columnWidgetName);
        if (items.length % 2 === 0) {
          return;
        }
        items.sort((a, b) =>
          (a.tablet.order ?? a.desktop.order) - (b.tablet.order ?? b.desktop.order)
        );
        return items[items.length - 1]._id;
      }
    };
  }
};
