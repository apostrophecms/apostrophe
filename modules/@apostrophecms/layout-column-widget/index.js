const alignSchema = {
  justify: {
    type: 'select',
    label: 'apostrophe:layoutJustify',
    choices: [
      {
        label: 'apostrophe:layoutStretch',
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
        label: 'apostrophe:layoutStretch',
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
  // widgetOperations: {
  //   add: {
  //     move: {
  //       icon: 'move',
  //       tooltip: 'Move',
  //       rawEvents: [ 'pointerdown', 'pointermove', 'pointerup' ]
  //     }
  //   }
  // },
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
            order: {
              type: 'integer',
              required: true
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
            order: {
              type: 'integer'
            },
            auto: {
              type: 'boolean',
              def: true
            },
            show: {
              type: 'boolean',
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
            order: {
              type: 'integer'
            },
            auto: {
              type: 'boolean',
              def: true
            },
            show: {
              type: 'boolean',
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
