module.exports = (moduleOptions) => {
  const options = moduleOptions.defaultStyles;
  return {
    width: {
      label: 'apostrophe:styleWidth',
      type: 'range',
      min: 0,
      max: 100,
      step: 10,
      def: 100,
      property: 'width',
      unit: '%'
    },
    alignment: {
      label: 'apostrophe:styleAlignment',
      type: 'select',
      class: true,
      choices: [
        {
          label: 'apostrophe:styleLeft',
          value: 'apos-left'
        },
        {
          label: 'apostrophe:styleCenter',
          value: 'apos-center'
        },
        {
          label: 'apostrophe:styleRight',
          value: 'apos-right'
        }
      ]
    },
    padding: {
      label: 'apostrophe:stylePadding',
      type: 'box',
      property: 'padding',
      unit: 'px'
    },
    margin: {
      label: 'apostrophe:styleMargin',
      type: 'box',
      property: 'margin',
      unit: 'px'
    },
    // A multi-field preset
    border: {
      label: 'apostrophe:styleBorder',
      type: 'object',
      options: {
        flat: true,
        hideLabel: true
      },
      fields: {
        add: {
          active: {
            label: 'apostrophe:styleBorder',
            type: 'boolean',
            def: false
          },
          width: {
            label: 'apostrophe:styleBorderWidth',
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
            property: 'border-%key%-width'
          },
          radius: {
            label: 'apostrophe:styleRadius',
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
            label: 'apostrophe:styleColor',
            type: 'color',
            def: options.borderColor,
            if: {
              active: true
            },
            property: 'border-color'
          },
          style: {
            label: 'apostrophe:styleStyle',
            type: 'select',
            def: 'solid',
            if: {
              active: true
            },
            choices: [
              {
                label: 'apostrophe:styleSolid',
                value: 'solid'
              },
              {
                label: 'apostrophe:styleDotted',
                value: 'dotted'
              },
              {
                label: 'apostrophe:styleDashed',
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
      label: 'apostrophe:styleShadow',
      type: 'object',
      valueTemplate: '%x% %y% %blur% %color%',
      property: 'box-shadow',
      options: {
        flat: true,
        hideLabel: true
      },
      fields: {
        add: {
          active: {
            label: 'apostrophe:styleShadow',
            type: 'boolean',
            def: false
          },
          x: {
            label: 'apostrophe:styleXOffset',
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
            label: 'apostrophe:styleYOffset',
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
            label: 'apostrophe:styleShadowBlur',
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
            label: 'apostrophe:styleShadowColor',
            type: 'color',
            def: options.shadowColor,
            if: {
              active: true
            }
          }
        }
      }
    },
    background: {
      label: 'apostrophe:styleBackground',
      type: 'object',
      customType: 'background',
      options: {
        flat: true,
        hideLabel: true
      },
      property: '--preset-bg',
      fields: {
        add: {
          enabled: {
            label: 'apostrophe:styleBackground',
            type: 'boolean',
            def: false
          },
          backgroundType: {
            label: 'apostrophe:styleBackgroundType',
            type: 'select',
            def: 'color',
            if: { enabled: true },
            choices: [
              {
                label: 'apostrophe:styleBackgroundColor',
                value: 'color'
              },
              {
                label: 'apostrophe:styleBackgroundGradient',
                value: 'gradient'
              },
              {
                label: 'apostrophe:styleBackgroundImage',
                value: 'image'
              }
            ]
          },
          color: {
            label: 'apostrophe:styleBackgroundColor',
            type: 'color',
            if: {
              enabled: true,
              backgroundType: 'color'
            }
          },
          gradientStart: {
            label: 'apostrophe:styleGradientStart',
            type: 'color',
            def: '#000000',
            if: {
              enabled: true,
              backgroundType: 'gradient'
            }
          },
          gradientEnd: {
            label: 'apostrophe:styleGradientEnd',
            type: 'color',
            def: '#ffffff',
            if: {
              enabled: true,
              backgroundType: 'gradient'
            }
          },
          gradientAngle: {
            label: 'apostrophe:styleGradientAngle',
            type: 'range',
            min: 0,
            max: 360,
            step: 5,
            def: 180,
            unit: 'deg',
            if: {
              enabled: true,
              backgroundType: 'gradient'
            }
          },
          _image: {
            label: 'apostrophe:styleBackgroundImage',
            type: 'relationship',
            withType: '@apostrophecms/image',
            max: 1,
            if: {
              enabled: true,
              backgroundType: 'image'
            }
          },
          overlay: {
            label: 'apostrophe:styleBackgroundOverlay',
            type: 'boolean',
            def: false,
            if: {
              enabled: true,
              backgroundType: 'image'
            }
          },
          overlayColor: {
            label: 'apostrophe:styleOverlayColor',
            type: 'color',
            def: '#000000',
            if: {
              enabled: true,
              backgroundType: 'image',
              overlay: true
            }
          },
          overlayOpacity: {
            label: 'apostrophe:styleOverlayOpacity',
            type: 'range',
            min: 0,
            max: 100,
            def: 50,
            if: {
              enabled: true,
              backgroundType: 'image',
              overlay: true
            }
          }
        }
      }
    }
  };
};
