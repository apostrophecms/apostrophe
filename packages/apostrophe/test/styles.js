const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Styles', function () {
  this.timeout(t.timeout);

  describe('Setup', function () {
    let apos;
    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {
            styles(self, options) {
              return {
                add: {
                  border: {
                    preset: 'border',
                    selector: '.border-style'
                  },
                  width: {
                    preset: 'width',
                    label: 'Custom Width',
                    selector: '.custom-width'
                  },
                  borderCard: {
                    preset: 'border',
                    label: 'Card Border',
                    selector: '.card'
                  }
                },
                group: {
                  typography: {
                    label: 'Styles',
                    group: {
                      border: {
                        label: 'Border',
                        inline: true,
                        fields: [ 'border' ]
                      },
                      width: {
                        label: 'Width',
                        fields: [ 'width' ]
                      },
                      borderCard: {
                        label: 'Border Card',
                        fields: [ 'borderCard' ]
                      }
                    }
                  }
                }
              };
            },
            extendMethods(self) {
              return {
                registerPresets(_super) {
                  _super();
                  // Extend an existing one:
                  const widthPreset = self.getPreset('width');

                  // Ensure we really change the default
                  assert.equal(
                    widthPreset.step,
                    10,
                    'Width preset should have step 10 by default'
                  );
                  widthPreset.step = 1;
                  self.setPreset('width', widthPreset);

                  // Add a custom one:
                  self.setPreset('customPreset', {
                    label: 'Custom Preset',
                    type: 'string',
                    def: 'custom',
                    property: 'customProperty'
                  });

                  // Test validation
                  assert.throws(
                    () => {
                      self.setPreset('invalidPreset', {
                        label: 'Invalid Preset'
                      });
                    },
                    {
                      message: /Preset must be an object with a "type" property/i
                    },
                    'Should validate preset type while registering'
                  );
                  assert.throws(
                    () => {
                      self.setPreset('anotherInvalidPreset', null);
                    },
                    {
                      message: /Preset must be an object with a "type" property/i
                    },
                    'Should validate null preset while registering'
                  );
                },

                // Test that presets getter fails before registration.
                composeSchema(_super, ...args) {
                  assert.throws(
                    () => {
                      self.getPreset('width');
                    },
                    {
                      message: /Presets have not been initialzed yet/i
                    },
                    'Should not be able to get presets before they are registered'
                  );
                  return _super(...args);
                }
              };
            }
          },
          'test-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Widget'
            },
            styles: {
              add: {
                border: 'border',
                width: {
                  preset: 'width',
                  label: 'Custom Width',
                  selector: '.custom-width'
                },
                backgroundColor: {
                  label: 'Background Color',
                  type: 'color',
                  required: true
                }
              }
            },
            fields: {
              add: {
                title: {
                  type: 'string',
                  label: 'Title'
                },
                aStyle: {
                  type: 'string',
                  label: 'A Style'
                }
              },
              // Explicit existing groups
              group: {
                basics: {
                  label: 'Basics',
                  fields: [ 'title' ]
                },
                styles: {
                  label: 'Styles',
                  fields: [ 'aStyle' ]
                }
              }
            }

          },
          'test-empty-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Groups Widget'
            }
          },
          'test-empty-styles-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Groups Widget'
            },
            fields: {
              add: {
                myField: {
                  type: 'string',
                  label: 'My Field'
                }
              }
            }
          },
          'test-empty-fields-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Empty Fields Widget'
            },
            styles: {
              add: {
                width: {
                  preset: 'width',
                  label: 'Custom Width',
                  selector: '.card'
                }
              }
            }
          },
          'test-nogroups-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test No Groups Widget'
            },
            fields: {
              add: {
                myField: {
                  type: 'string',
                  label: 'A Style'
                }
              }
            },
            styles: {
              add: {
                width: {
                  preset: 'width',
                  label: 'Custom Width',
                  selector: '.card'
                }
              }
            }
          }
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });
    it('@apostrophecms/styles should exist', async function () {
      assert(
        apos.modules['@apostrophecms/styles'],
        '@apostrophecms/styles module should exist'
      );
      assert(apos.styles, 'Alias `apos.styles` should exist');
    });

    it('should cascade styles (@apostrophecms/styles)', async function () {
      assert(apos.styles.styles, '@apostrophecms/styles should have a styles property');
      const schema = apos.styles.schema;
      const borderField = schema.find(field => field.name === 'border');
      const widthField = schema.find(field => field.name === 'width');
      const borderCardField = schema.find(field => field.name === 'borderCard');

      assert.equal(borderField?.type, 'object', 'Border field not expanded correctly');
      assert.equal(borderField.group.name, 'ungrouped', 'Styles groups should be ungrouped');
      assert.equal(widthField?.type, 'range', 'Width field not expanded correctly');
      assert.equal(widthField.group.name, 'ungrouped', 'Styles groups should be ungrouped');
      assert.equal(
        borderCardField?.type,
        'object',
        'Border Card field not expanded correctly'
      );
      assert.equal(borderCardField.group.name, 'ungrouped', 'Styles groups should be ungrouped');
    });

    it('should cascade styles (widgets)', async function () {
      assert(apos.modules['test-widget'].styles, 'test-widget should have a styles property');
      const schema = apos.modules['test-widget'].schema;
      const borderField = schema.find(field => field.name === 'border');
      const widthField = schema.find(field => field.name === 'width');
      const backgroundColorField = schema.find(field => field.name === 'backgroundColor');
      const titleField = schema.find(field => field.name === 'title');
      const aStyleField = schema.find(field => field.name === 'aStyle');

      assert.equal(borderField?.type, 'object', 'Border field not expanded correctly');
      assert.equal(borderField.group.name, 'styles', 'Border field not in styles group');
      assert.equal(widthField?.type, 'range', 'Width field not expanded correctly');
      assert.equal(widthField.group.name, 'styles', 'Width field not in styles group');
      assert.equal(
        backgroundColorField?.type,
        'color',
        'Background Color field not expanded correctly'
      );
      assert.equal(
        backgroundColorField.group.name,
        'styles',
        'Background Color field not in styles group'
      );

      assert.deepEqual(
        apos.modules['test-widget'].fieldsGroups.styles.fields,
        [ 'border', 'width', 'backgroundColor', 'aStyle' ],
        'Styles group should contain all style fields in the right order'
      );

      assert.equal(titleField?.type, 'string', 'Title field should remain unchanged');
      assert.equal(titleField.group.name, 'basics', 'Title field should remain in basics group');
      assert.equal(aStyleField?.type, 'string', 'aStyle field should remain unchanged');
      assert.equal(aStyleField.group.name, 'styles', 'sStyle field should be in styles group');
    });

    it('should handle empty styles and fields groups (widgets)', async function () {
      assert.deepEqual(
        apos.modules['test-empty-widget'].fieldsGroups,
        {},
        'Fields groups should be empty'
      );
    });

    it('should handle empty styles groups (widgets)', async function () {
      assert.deepEqual(
        apos.modules['test-empty-styles-widget'].fieldsGroups,
        {},
        'Fields groups should be empty'
      );
    });

    it('should handle empty fields groups (widgets)', async function () {
      assert.deepEqual(
        apos.modules['test-empty-fields-widget'].fieldsGroups,
        {
          styles: {
            label: 'apostrophe:styles',
            fields: [ 'width' ]
          }
        },
        'Fields groups should contain basics and styles groups'
      );
    });

    it('should handle fields and styles groups (widgets)', async function () {
      assert.deepEqual(
        apos.modules['test-nogroups-widget'].fieldsGroups,
        {
          basics: {
            label: 'apostrophe:basics',
            fields: [ 'myField' ]
          },
          styles: {
            label: 'apostrophe:styles',
            fields: [ 'width' ]
          }
        },
        'Fields groups should contain basics and styles groups'
      );
    });

    it('should register and retrieve presets', async function () {
      const borderPreset = apos.styles.getPreset('border');
      const widthPreset = apos.styles.getPreset('width');
      const customPreset = apos.styles.getPreset('customPreset');

      assert(borderPreset, 'Border preset should be registered');

      assert(widthPreset, 'Width preset should be registered');
      assert.equal(
        widthPreset.step,
        1,
        'Width preset should be modified correctly'
      );

      assert(customPreset, 'Custom preset should be registered');
      assert.equal(
        customPreset.type,
        'string',
        'Custom preset should be registered correctly'
      );
    });

    it('should fail to set presets after initialization', async function () {
      assert.throws(
        () => {
          apos.styles.setPreset('anotherPreset', {
            label: 'Another Preset',
            type: 'string',
            property: 'anotherProperty'
          });
        },
        {
          message: /Attempt to set preset anotherPreset after initialization/i
        },
        'Should throw an error when trying to set a preset after initialization'
      );
    });
  });

  describe('Object styles', function () {
    let apos;
    // A multi-field as selector
    const styleSelectorConfig = (options) => ({
      border: {
        label: 'apostrophe:styleBorder',
        type: 'object',
        selector: '.border-style',
        fields: {
          add: {
            active: {
              label: 'apostrophe:styleBorder',
              type: 'boolean',
              def: false
            },
            width: {
              label: 'apostrophe:styleWidth',
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
      }
    });
    // A multi-field with valueTemplate
    // const styleTemlateConfig = (options) => ({
    //   boxShadow: {
    //     label: 'apostrophe:styleShadow',
    //     type: 'object',
    //     valueTemplate: '%x% %y% %blur% %color%',
    //     property: 'box-shadow',
    //     fields: {
    //       add: {
    //         active: {
    //           label: 'apostrophe:styleShadow',
    //           type: 'boolean',
    //           def: false
    //         },
    //         x: {
    //           label: 'apostrophe:styleXOffset',
    //           type: 'range',
    //           min: -32,
    //           max: 32,
    //           def: 4,
    //           if: {
    //             active: true
    //           },
    //           unit: 'px'
    //         },
    //         y: {
    //           label: 'apostrophe:styleYOffset',
    //           type: 'range',
    //           min: -32,
    //           max: 32,
    //           def: 4,
    //           unit: 'px',
    //           if: {
    //             active: true
    //           }
    //         },
    //         blur: {
    //           label: 'apostrophe:styleShadowBlur',
    //           type: 'range',
    //           min: 0,
    //           max: 32,
    //           def: 2,
    //           if: {
    //             active: true
    //           },
    //           unit: 'px'
    //         },
    //         color: {
    //           label: 'apostrophe:styleShadowColor',
    //           type: 'color',
    //           def: options.shadowColor,
    //           if: {
    //             active: true
    //           }
    //         }
    //       }
    //     }
    //   }
    // });

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {
            styles(self, options) {
              return {
                add: {
                  border: styleSelectorConfig(options).border
                }
              };
            }
          },
          'test-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Widget'
            },
            styles: {
              add: {
                border: styleSelectorConfig({
                  borderColor: 'black',
                  shadowColor: 'gray'
                }).border
              }
            }
          }
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('should render object styles correctly (@apstrophecms/styles)', async function () {
      const styles = await apos.styles.getStylesheet(
        {
          border: {
            active: true,
            width: {
              top: 2,
              right: 4,
              bottom: 2,
              left: 4
            },
            radius: 8,
            color: 'red',
            style: 'dashed'
          },
          boxShadow: {
            active: true,
            x: 5,
            y: 5,
            blur: 10,
            color: 'rgba(0,0,0,0.5)'
          }
        }
      );
      const expected = {
        selector: styles.startsWith('.border-style{'),
        selectorEnd: styles.endsWith('}'),
        borderWidthTop: styles.includes('border-width-top: 2px'),
        borderWidthRight: styles.includes('border-width-right: 4px'),
        borderWidthBottom: styles.includes('border-width-bottom: 2px'),
        borderWidthLeft: styles.includes('border-width-left: 4px'),
        borderRadius: styles.includes('border-radius: 8px;'),
        borderColor: styles.includes('border-color: red;'),
        borderStyle: styles.includes('border-style: dashed;')
      };
      assert.deepEqual(expected, {
        selector: true,
        selectorEnd: true,
        borderWidthTop: true,
        borderWidthRight: true,
        borderWidthBottom: true,
        borderWidthLeft: true,
        borderRadius: true,
        borderColor: true,
        borderStyle: true
      });
    });

    it('should render object with selector correctly (widgets)', async function () {
      const styles = await apos.modules['test-widget'].getStylesheet(
        {
          border: {
            active: true,
            width: {
              top: 3,
              right: 3,
              bottom: 3,
              left: 3
            },
            radius: 12,
            color: 'blue',
            style: 'dotted'
          },
          boxShadow: {
            active: true,
            x: 2,
            y: 2,
            blur: 5,
            color: 'rgba(0,0,0,0.3)'
          }
        },
        'randomStyleId'
      );

      const expected = {
        selector: styles.startsWith('#randomStyleId .border-style{'),
        selectorEnd: styles.endsWith('}'),
        borderWidthTop: styles.includes('border-width-top: 3px'),
        borderWidthRight: styles.includes('border-width-right: 3px'),
        borderWidthBottom: styles.includes('border-width-bottom: 3px'),
        borderWidthLeft: styles.includes('border-width-left: 3px'),
        borderRadius: styles.includes('border-radius: 12px;'),
        borderColor: styles.includes('border-color: blue;'),
        borderStyle: styles.includes('border-style: dotted;')
      };
      assert.deepEqual(expected, {
        selector: true,
        selectorEnd: true,
        borderWidthTop: true,
        borderWidthRight: true,
        borderWidthBottom: true,
        borderWidthLeft: true,
        borderRadius: true,
        borderColor: true,
        borderStyle: true
      });
    });
  });
});
