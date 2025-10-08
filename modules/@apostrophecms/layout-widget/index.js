const path = require('node:path');
const fs = require('node:fs');

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
    defaultCellVerticalAlignment: null,
    injectStyles: true,
    minifyStyles: true
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
              '@apostrophecms/layout-column': {}
            }
          }
        }
      }
    };
  },
  async init(self) {
    self.columnWidgetName = '@apostrophecms/layout-column';

    if (
      self.__meta.name === '@apostrophecms/layout-widget' &&
      self.options.injectStyles !== false
    ) {
      self.stylesContent = await self.loadAndProcessStyles();
      self.appendNodes('head', 'publicCssNodes');
    }
  },
  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        validateAndIdentifyTypes() {
          const { column } = self.validateAndIdentifyTypes();
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
          columnWidgetName: self.columnWidgetName
        };
      }
    };
  },
  methods(self) {
    return {
      publicCssNodes(req) {
        return [
          {
            comment: ' Layout styles '
          },
          {
            name: 'style',
            attrs: { type: 'text/css' },
            body: [
              {
                raw: self.stylesContent[req.scene] || self.stylesContent.public
              }
            ]
          },
          {
            comment: ' End Layout styles '
          }
        ];
      },
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
        if (widgetTypes.length !== 1) {
          throw new Error(
            `The layout widget "columns" area must have exactly one widget type, it has ${widgetTypes.length}.`
          );
        }

        const hasTypes = {
          [self.columnWidgetName]: false
        };
        const targetTypes = Object.keys(hasTypes);
        const targetModuleTypes = targetTypes.map(type => `${type}-widget`);
        for (const widgetType of widgetTypes) {
          if (targetTypes.includes(widgetType)) {
            hasTypes[widgetType] = widgetType;
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
            hasTypes[mappedType] = widgetType;
            continue;
          }
        }
        if (!hasTypes[self.columnWidgetName]) {
          throw new Error(
            `The layout widget "columns" area must have a widget type or a subtype of "${self.columnWidgetName}"`
          );
        }

        // Force critical options on the columns area in case of a subclassing
        if (!columnsField.options.editorComponent) {
          columnsField.options.editorComponent = 'AposAreaLayoutEditor';
        }
        if (!columnsField.options.widgetTemplate) {
          columnsField.options.widgetTemplate = '@apostrophecms/layout-widget:column.html';
        }

        return {
          column: hasTypes[self.columnWidgetName]
        };
      },
      async loadAndProcessStyles() {
        const cssFilePath = path.join(__dirname, 'ui', 'src', 'layout.css');
        let cssContent = fs.readFileSync(cssFilePath, 'utf8');
        const mobileBreakpoint = self.options.mobile?.breakpoint || 600;
        const mobileBreakpointPlus = mobileBreakpoint + 1;
        const tabletBreakpoint = self.options.tablet?.breakpoint || 1024;
        const tabletBreakpointPlus = tabletBreakpoint + 1;
        cssContent = cssContent
          .replace(/\{\$mobile\}/g, mobileBreakpoint)
          .replace(/\{\$mobile-plus\}/g, mobileBreakpointPlus)
          .replace(/\{\$tablet\}/g, tabletBreakpoint)
          .replace(/\{\$tablet-plus\}/g, tabletBreakpointPlus);

        return self.processCss(cssContent);
      },
      async processCss(cssContent) {
        try {
          const postcss = require('postcss');
          const cssnano = require('cssnano');
          const options = self.apos.asset.options.breakpointPreviewMode || {};
          let resultPublic = { css: cssContent };

          // A way to debug the css
          if (self.options.minifyStyles !== false) {
            resultPublic = await postcss([
              cssnano({
                preset: 'default'
              })
            ]).process(cssContent, { from: undefined });
          }

          if (options.enable !== true) {
            return {
              apos: resultPublic.css,
              public: resultPublic.css
            };
          }

          const mobilePreview = require('postcss-viewport-to-container-toggle');

          // A separate pass for admin with the plain content - can't minify
          // twice, should minify the mobile preview output as well.
          const resultApos = await postcss([
            mobilePreview({
              modifierAttr: 'data-breakpoint-preview-mode',
              debug: options.debug === true,
              transform: options.transform || null
            }),
            ...(self.options.minifyStyles === false
              ? []
              : [
                cssnano({
                  preset: 'default'
                })
              ]
            )
          ]).process(cssContent, { from: undefined });

          return {
            apos: resultApos.css,
            public: resultPublic.css
          };
        } catch (error) {
          const errorTrace = error.stack
            ? error.stack
              .split('\n')
              .slice(1)
            : [];
          self.logWarn('inline-css-minify-failed', error.message, {
            error: errorTrace
          });
          return {
            apos: cssContent,
            public: cssContent
          };
        }
      }
    };
  },
  helpers(self) {
    return {
      detectLastTabletFullWidthItem(widgets) {
        if (!Array.isArray(widgets)) {
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
