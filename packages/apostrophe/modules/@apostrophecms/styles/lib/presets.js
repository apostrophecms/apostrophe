module.exports = (options) => {
  // FIXME i18n
  return {
    width: {
      label: 'Width %',
      type: 'range',
      min: 0,
      max: 100,
      step: 10,
      def: 100,
      property: 'width',
      unit: '%'
    },
    alignment: {
      label: 'Alignment',
      type: 'select',
      class: true,
      def: 'apos-center',
      choices: [
        {
          label: 'Left',
          value: 'apos-left'
        },
        {
          label: 'Center',
          value: 'apos-center'
        },
        {
          label: 'Right',
          value: 'apos-right'
        }
      ]
    },
    padding: {
      label: 'Padding',
      type: 'box',
      property: 'padding',
      unit: 'px'
    },
    margin: {
      label: 'Margin',
      type: 'box',
      property: 'margin',
      unit: 'px'
    },
    // A multi-field preset
    border: {
      label: 'Border',
      type: 'object',
      fields: {
        add: {
          active: {
            label: 'Border',
            type: 'boolean',
            def: false
          },
          width: {
            label: 'Width',
            type: 'box',
            def: {
              top: 1,
              right: 1,
              bottom: 1,
              left: 1
            },
            if: {
              active: true
            },
            unit: 'px',
            property: 'border-width'
          },
          radius: {
            label: 'Radius',
            type: 'range',
            min: 0,
            max: 32,
            def: 0,
            if: {
              active: true
            },
            property: 'border-radius',
            unit: 'px'
          },
          color: {
            label: 'Color',
            type: 'color',
            def: options.borderColor,
            if: {
              active: true
            },
            property: 'border-color'
          },
          style: {
            label: 'Style',
            type: 'select',
            def: 'solid',
            if: {
              active: true
            },
            choices: [
              {
                label: 'Solid',
                value: 'solid'
              },
              {
                label: 'Dotted',
                value: 'dotted'
              },
              {
                label: 'Dashed',
                value: 'dashed'
              }
            ],
            property: 'border-style'
          }
        }
      }
    },
    // A multi-field preset
    boxShadow: {
      label: 'Shadow',
      type: 'object',
      valueTemplate: '%x% %y% %blur% %color%',
      fields: {
        add: {
          active: {
            label: 'Shadow',
            type: 'boolean',
            def: false
          },
          x: {
            label: 'X Offset',
            type: 'range',
            min: -32,
            max: 32,
            def: 4,
            if: {
              active: true
            },
            unit: 'px'
          },
          y: {
            label: 'Y Offset',
            type: 'range',
            min: -32,
            max: 32,
            def: 4,
            unit: 'px',
            if: {
              active: true
            }
          },
          blur: {
            label: 'Shadow Blur',
            type: 'range',
            min: 0,
            max: 32,
            def: 2,
            if: {
              active: true
            },
            unit: 'px'
          },
          color: {
            label: 'Shadow Color',
            type: 'color',
            def: options.shadowColor,
            if: {
              active: true
            }
          }
        }
      }
    }
  };
};
