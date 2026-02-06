const alignSchema = {
  justify: {
    type: 'select',
    label: 'apostrophe:layoutJustify',
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
};

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
        layoutColConfig: {
          placement: 'breadcrumb',
          icon: 'cog-icon',
          type: 'menu',
          modal: 'AposLayoutColControlDialog'
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
  fields(self, options) {
    const breakpoints = options?.labelBreakpoints ||
      options?.breakpoints || // BC, derpecated
      {};
    return {
      add: {
        desktop: {
          type: 'object',
          fields: {
            add: {
              colstart: {
                type: 'integer',
                required: true
              },
              colspan: {
                type: 'integer',
                required: true
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
              ...alignSchema
            }
          }
        },
        tablet: {
          type: 'object',
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
              show: {
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
              ...alignSchema
            }
          }
        },
        mobile: {
          type: 'object',
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
              show: {
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
              ...alignSchema
            }
          }
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
      }
    };
  }
};
