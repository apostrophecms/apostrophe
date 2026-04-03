module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'apostrophe:layoutColumn',
    contextualStyles: true,
    operationsInBreadcrumb: true,
    // The breakpoints used in the breakpoint visibility fields
    // help text for the layout column
    labelBreakpoints: {
      mobile: 600,
      tablet: 900
    },
    // Whether to show help text for the breakpoint visibility fields
    showBreakpointsHelp: true
  },
  widgetOperations(self, options) {
    return {
      add: {
        layoutColMove: {
          nativeAction: 'move',
          placement: 'breadcrumb',
          icon: 'cursor-move-icon',
          rawEvents: [ 'mousedown', 'touchstart' ]
        },
        layoutColEditStyles: {
          action: 'apos-edit-styles',
          placement: 'breadcrumb',
          icon: 'palette-icon',
          tooltip: 'apostrophe:stylesWidget'
        },
        layoutColDelete: {
          action: 'apos-layout-col-delete',
          placement: 'breadcrumb',
          icon: 'delete-icon',
          tooltip: 'apostrophe:delete'
        }
      }
    };
  },
  extendMethods(self, options) {
    return {
      disableWidgetOperation(_super, opName, properties) {
        if (
          _super() ||
          (opName === 'layoutColEditStyles' && !Object.keys(self.styles).length)
        ) {
          return true;
        }
        return false;
      }
    };
  },
  fields: {
    add: {
      colstart: {
        type: 'integer'
      },
      colspan: {
        type: 'integer'
      },
      rowstart: {
        type: 'integer',
        def: 1
      },
      rowspan: {
        type: 'integer',
        def: 1
      },
      order: {
        type: 'integer'
      },
      content: {
        type: 'area',
        options: {
          widgets: {
            '@apostrophecms/rich-text': {},
            '@apostrophecms/image': {},
            '@apostrophecms/video': {},
            '@apostrophecms/file': {}
          }
        }
      }
    },
    // `utility` group is specifically excluded from tab
    // rendering in AposModalTabsMixin, we show only Styles.
    group: {
      utility: {
        fields: [ 'colstart', 'colspan', 'rowstart', 'rowspan', 'order', 'content' ]
      }
    }
  },
  styles(self, options) {
    const breakpoints = options?.labelBreakpoints ||
      options?.breakpoints || // BC, deprecated
      {};
    return {
      add: {
        showTablet: {
          type: 'boolean',
          label: 'apostrophe:layoutTabletShow',
          ...(options?.showBreakpointsHelp
            ? {
              help: 'apostrophe:layoutTabletShowHelp',
              helpInterpolation: {
                mobile: breakpoints.mobile || 600,
                tablet: breakpoints.tablet || 900
              }
            }
            : {}),
          def: true
        },
        showMobile: {
          type: 'boolean',
          label: 'apostrophe:layoutMobileShow',
          ...(options?.showBreakpointsHelp
            ? {
              help: 'apostrophe:layoutMobileShowHelp',
              helpInterpolation: {
                mobile: breakpoints.mobile || 600
              }
            }
            : {}),
          def: true
        },
        justify: {
          type: 'select',
          label: 'apostrophe:layoutJustify',
          property: '--justify',
          choices: [
            {
              label: 'apostrophe:layoutStretchHorizontal',
              value: 'stretch'
            },
            {
              label: 'apostrophe:layoutLeft',
              value: 'start'
            },
            {
              label: 'apostrophe:layoutRight',
              value: 'end'
            },
            {
              label: 'apostrophe:layoutCenter',
              value: 'center'
            }
          ]
        },
        align: {
          type: 'select',
          label: 'apostrophe:layoutAlign',
          property: '--align',
          choices: [
            {
              label: 'apostrophe:layoutStretchVertical',
              value: 'stretch'
            },
            {
              label: 'apostrophe:layoutTop',
              value: 'start'
            },
            {
              label: 'apostrophe:layoutBottom',
              value: 'end'
            },
            {
              label: 'apostrophe:layoutMiddle',
              value: 'center'
            }
          ]
        }
      }
    };
  },
  init(self) {
    self.addColumnWidgetMigration();
  },
  methods(self) {
    return {
      addColumnWidgetMigration() {
        self.apos.migration.add(
          `${self.__meta.name}:flatten-column-schema`,
          async () => {
            await self.apos.migration.eachWidget({}, 5, async (doc, widget, dotPath) => {
              if (widget.type !== self.name) {
                return;
              }
              const update = self.migrateColumnWidget(widget, dotPath);
              if (!update) {
                return;
              }
              await self.apos.doc.db.updateOne(
                { _id: doc._id },
                update
              );
            });
          }
        );
      },

      migrateColumnWidget(widget, dotPath) {
        if (typeof widget.showTablet === 'boolean') {
          return null;
        }
        const d = widget.desktop || {};
        return {
          $set: {
            [`${dotPath}.colstart`]: d.colstart ?? null,
            [`${dotPath}.colspan`]: d.colspan ?? null,
            [`${dotPath}.rowstart`]: d.rowstart ?? 1,
            [`${dotPath}.rowspan`]: d.rowspan ?? 1,
            [`${dotPath}.order`]: d.order ?? null,
            [`${dotPath}.justify`]: d.justify ?? null,
            [`${dotPath}.align`]: d.align ?? null,
            [`${dotPath}.showTablet`]: widget.tablet?.show ?? true,
            [`${dotPath}.showMobile`]: widget.mobile?.show ?? true
          }
        };
      }
    };
  }
};
