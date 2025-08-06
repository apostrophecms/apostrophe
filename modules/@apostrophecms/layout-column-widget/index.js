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
  //       tooltip: 'apostrophe:move',
  //       rawEvents: [ 'pointerdown', 'pointermove', 'pointerup' ]
  //     }
  //   }
  // },
  fields: {
    add: {
      start: {
        type: 'integer',
        required: true
      },
      span: {
        type: 'integer',
        required: true
      },
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
            label: 'Center',
            value: 'apostrophe:layoutCenter'
          }
        ],
        def: 'center'
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
        ],
        def: 'start'
      },
      showOnMobile: {
        type: 'boolean',
        def: true
      },
      showOnTablet: {
        type: 'boolean',
        def: true
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
