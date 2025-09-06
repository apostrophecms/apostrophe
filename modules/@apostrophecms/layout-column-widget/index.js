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
    operationsInBreadcrumb: true
  },
  widgetOperations(self, options) {
    return {
      add: {
        layoutColConfig: {
          placement: 'breadcrumb',
          icon: 'cog-icon',
          tooltip: 'Configure column',
          type: 'menu',
          modal: 'AposLayoutColControlDialog'
        },
        layoutColDelete: {
          placement: 'breadcrumb',
          icon: 'delete-icon',
          tooltip: 'Delete column'
        }
      }
    };
  },
  fields: {
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
              label: 'Visible on tablet',
              help: `Less than ${this.options?.breakpoints?.tablet || 900}px`,
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
              label: 'Visible on mobile',
              help: `Less than ${this.options?.breakpoints?.mobile || 600}px`,
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
            '@apostrophecms/video': {}
          }
        }
      }
    }
  }
};
