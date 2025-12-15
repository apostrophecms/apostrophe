const t = require('../test-lib/test.js');
const assert = require('assert/strict');
const universal = import(
  '../modules/@apostrophecms/styles/ui/universal/render.mjs'
);

describe('Styles', function () {
  this.timeout(t.timeout);

  describe('Universal Renderer', function () {
    let apos;
    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {}
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('should export render styles functions', async function () {
      const {
        default: renderStyles, renderGlobalStyles, renderScopedStyles
      } = await universal;
      assert.equal(
        typeof renderStyles,
        'function',
        'Default export should be a function'
      );
      assert.equal(
        typeof renderGlobalStyles,
        'function',
        'renderGlobalStyles should be a function'
      );
      assert.equal(
        typeof renderScopedStyles,
        'function',
        'renderScopedStyles should be a function'
      );
    });

    it('should normalize field', async function () {
      const { NORMALIZERS } = await universal;
      // Basic field
      {
        const field = {
          name: 'testField',
          type: 'string',
          selector: '.test-class',
          property: 'color',
          unit: 'px'
        };
        const actual = NORMALIZERS._(
          field,
          {
            testField: 'red'
          }
        );
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [ '.test-class' ],
            properties: [ 'color' ],
            value: 'red',
            unit: 'px'
          },
          'Basic field should be normalized correctly'
        );
      }

      // Basic field with rootSelector
      {
        const field = {
          name: 'testField',
          type: 'string',
          selector: '.test-class',
          property: 'color',
          unit: 'px'
        };
        const actual = NORMALIZERS._(
          field,
          {
            testField: 'red'
          },
          {
            rootSelector: '#root'
          }
        );
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [ '#root .test-class' ],
            properties: [ 'color' ],
            value: 'red',
            unit: 'px'
          },
          'Basic field with rootSelector should be normalized correctly'
        );
      }

      // Basic field with array selector
      {
        const field = {
          name: 'testField',
          type: 'string',
          selector: [ '.class1', '.class2' ],
          property: 'color',
          unit: 'px'
        };
        const actual = NORMALIZERS._(
          field,
          {
            testField: 'red'
          }
        );
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [ '.class1', '.class2' ],
            properties: [ 'color' ],
            value: 'red',
            unit: 'px'
          },
          'Basic field with array selector should be normalized correctly'
        );
      }

      // Basic field with array property
      {
        const field = {
          name: 'testField',
          type: 'string',
          selector: '.test-class',
          property: [ 'color', 'background-color' ],
          unit: 'px'
        };
        const actual = NORMALIZERS._(
          field,
          {
            testField: 'red'
          }
        );
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [ '.test-class' ],
            properties: [ 'color', 'background-color' ],
            value: 'red',
            unit: 'px'
          },
          'Basic field with array property should be normalized correctly'
        );
      }

      // Basic field with rootSelector and without field selector
      {
        const field = {
          name: 'testField',
          type: 'string',
          property: 'color',
          unit: 'px'
        };
        const actual = NORMALIZERS._(
          field,
          {
            testField: 'red'
          },
          {
            rootSelector: '#root'
          }
        );
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [ '#root' ],
            properties: [ 'color' ],
            value: 'red',
            unit: 'px'
          },
          'Basic field with rootSelector and without field selector should be normalized correctly'
        );
      }

      // Empty, not relevant to styles field, that will be skipped later
      {
        const field = {
          name: 'hasBorder',
          type: 'boolean'
        };
        const actual = NORMALIZERS._(
          field,
          {
            hasBorder: true
          }
        );
        assert.deepEqual(
          actual,
          {
            raw: field,
            selectors: [],
            properties: [],
            value: true,
            unit: ''
          },
          'Empty field should be normalized correctly'
        );
      }
    });

    it('should normalize object field (UI container)', async function () {
      const { NORMALIZERS } = await universal;
      const subField1 = {
        name: 'subField1',
        type: 'string',
        selector: '.sub-class1',
        property: 'color',
        unit: 'px'
      };
      const subField2 = {
        name: 'subField2',
        type: 'string',
        selector: '.sub-class2',
        property: 'background-color',
        unit: 'px'
      };
      const field = {
        name: 'testObjectField',
        type: 'object',
        schema: [ subField1, subField2 ]
      };
      const { subfields: actualSubfields, ...actualObject } = NORMALIZERS.object(
        field,
        {
          testObjectField: {
            subField1: 'blue',
            subField2: 'green'
          }
        }
      );
      assert.deepEqual(
        actualObject,
        {
          raw: field,
          selectors: [],
          properties: [],
          value: {
            subField1: 'blue',
            subField2: 'green'
          }
        },
        'Object field container should be normalized correctly'
      );
      assert.deepEqual(
        actualSubfields.length,
        2,
        'Object field should have two subfields'
      );
      assert.deepEqual(
        actualSubfields[0],
        {
          raw: subField1,
          selectors: [ '.sub-class1' ],
          properties: [ 'color' ],
          value: 'blue',
          unit: 'px'
        },
        'First subfield should be normalized correctly'
      );
      assert.deepEqual(
        actualSubfields[1],
        {
          raw: subField2,
          selectors: [ '.sub-class2' ],
          properties: [ 'background-color' ],
          value: 'green',
          unit: 'px'
        },
        'Second subfield should be normalized correctly'
      );
    });

    it('should normalize object field with deep selectors', async function () {
      const { NORMALIZERS } = await universal;
      const isEnabled = {
        name: 'isEnabled',
        type: 'boolean'
      };
      const subField1 = {
        name: 'subField1',
        type: 'string',
        selector: '.sub-class1',
        property: 'color',
        unit: 'px'
      };
      const subField2 = {
        name: 'subField2',
        type: 'string',
        property: 'background-color',
        unit: 'px'
      };
      const field = {
        name: 'testObjectField',
        type: 'object',
        selector: '.object-class',
        valueTemplate: '%subField1% %subField2%',
        schema: [ isEnabled, subField1, subField2 ]
      };
      const actual = NORMALIZERS.object(
        field,
        {
          testObjectField: {
            isEnabled: true,
            subField1: 'blue',
            subField2: 'green'
          }
        },
        {
          rootSelector: '#root'
        }
      );

      const { subfields: actualSubfieds, ...actualObject } = actual;
      assert.deepEqual(
        actualObject,
        {
          raw: field,
          selectors: [ '#root .object-class' ],
          properties: [],
          value: {
            isEnabled: true,
            subField1: 'blue',
            subField2: 'green'
          },
          valueTemplate: '%subField1% %subField2%'
        },
        'Object field root field should be normalized correctly'
      );
      assert.equal(
        actualSubfieds.length,
        2,
        'Object field should have two subfields'
      );
      assert.deepEqual(
        actualSubfieds[0],
        {
          raw: subField1,
          selectors: [ '#root .object-class .sub-class1' ],
          properties: [ 'color' ],
          value: 'blue',
          unit: 'px'
        },
        'First subfield should be normalized correctly'
      );
      assert.deepEqual(
        actualSubfieds[1],
        {
          raw: subField2,
          selectors: [ '#root .object-class' ],
          properties: [ 'background-color' ],
          value: 'green',
          unit: 'px'
        },
        'Second subfield should be normalized correctly'
      );
    });

    it('should normalize object field with only root selector', async function () {
      const { NORMALIZERS } = await universal;
      const subField1 = {
        name: 'subField1',
        type: 'string',
        property: '--primary-color'
      };
      const field = {
        name: 'testObjectField',
        type: 'object',
        schema: [ subField1 ]
      };
      const actual = NORMALIZERS.object(
        field,
        {
          testObjectField: {
            subField1: 'blue'
          }
        },
        {
          rootSelector: ':root'
        }
      );
      const { subfields: actualSubfieds, ...actualObject } = actual;
      assert.deepEqual(
        actualObject,
        {
          raw: field,
          selectors: [ ':root' ],
          properties: [],
          value: {
            subField1: 'blue'
          }
        },
        'Object field root field should be normalized correctly'
      );
      assert.equal(
        actualSubfieds.length,
        1,
        'Object field should have one subfield'
      );
      assert.deepEqual(
        actualSubfieds[0],
        {
          raw: subField1,
          selectors: [ ':root' ],
          properties: [ '--primary-color' ],
          value: 'blue',
          unit: ''
        },
        'First subfield should be normalized correctly'
      );
    });
  });

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
    const inlineStyleConfig = (options) => ({
      border: {
        label: 'apostrophe:styleBorder',
        type: 'object',
        fields: {
          add: {
            width: {
              label: 'apostrophe:styleWidth',
              type: 'box',
              def: {
                top: 1,
                right: 1,
                bottom: 1,
                left: 1
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
              property: 'border-radius',
              unit: 'px'
            },
            color: {
              label: 'apostrophe:styleColor',
              type: 'color',
              def: options.borderColor,
              property: 'border-color'
            },
            style: {
              label: 'apostrophe:styleStyle',
              type: 'select',
              def: 'solid',
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
    const classesStyleConfig = () => ({
      alignSelect: {
        type: 'select',
        class: true,
        choices: [
          {
            label: 'None',
            value: ''
          },
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
        ],
        def: ''
      },
      leftBoolean: {
        type: 'boolean',
        class: 'apos-left',
        def: false
      },
      checkboxes: {
        type: 'checkboxes',
        class: true,
        choices: [
          {
            label: 'Rounded Corners',
            value: 'rounded-corners'
          },
          {
            label: 'Shadow',
            value: 'shadow'
          },
          {
            label: 'Border',
            value: 'border'
          }
        ]
      }
    });
    const mediaQueryStyleConfig = () => ({
      responsivePadding: {
        type: 'object',
        mediaQuery: '(width > 1200px)',
        selector: '.responsive-padding',
        fields: {
          add: {
            desktop: {
              type: 'range',
              min: 0,
              max: 32,
              def: 0,
              property: 'padding',
              unit: 'px'
            },
            tablet: {
              type: 'range',
              min: 0,
              max: 32,
              def: 0,
              property: 'padding',
              unit: 'px',
              mediaQuery: '(560px < width <= 1200px)'
            },
            mobile: {
              type: 'range',
              min: 0,
              max: 32,
              def: 0,
              property: 'padding',
              unit: 'px',
              mediaQuery: '(width <= 560px)'
            }
          }
        }
      }
    });
    const valueTemplateStyleConfig = () => ({
      boxShadow: {
        type: 'object',
        valueTemplate: '%x% %y% %blur% %color%',
        property: 'box-shadow',
        selector: '.box-shadow',
        fields: {
          add: {
            active: {
              type: 'boolean'
            },
            // Assert no output when one of the fields is missing
            x: {
              type: 'range',
              min: -32,
              max: 32,
              def: 4,
              unit: 'px',
              if: {
                active: true
              }
            },
            y: {
              type: 'range',
              min: -32,
              max: 32,
              def: 4,
              unit: 'px'
            },
            blur: {
              type: 'range',
              min: 0,
              max: 32,
              def: 2,
              unit: 'px'
            },
            color: {
              type: 'color'
            },
            standalone: {
              type: 'integer',
              property: 'width',
              // No unit to test interpolation in valueTemplate
              valueTemplate: '%VALUE%px'
            }
          }
        }
      }
    });
    const boxValueTemplateConfig = (options) => ({
      position: {
        type: 'object',
        valueTemplate: '%box.top% %box.right% %box.bottom% %box.left%',
        property: 'inset',
        selector: '.box-position',
        fields: {
          add: {
            active: {
              type: 'boolean'
            },
            box: {
              type: 'box',
              unit: 'px',
              if: {
                active: true
              }
            }
          }
        }
      }
    });

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {
            styles(self, options) {
              return {
                add: {
                  border: styleSelectorConfig(options).border,
                  ...classesStyleConfig(),
                  ...mediaQueryStyleConfig(),
                  ...valueTemplateStyleConfig(),
                  ...boxValueTemplateConfig()
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
          },
          'test-inline-style-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Inline Style Widget'
            },
            styles: {
              add: inlineStyleConfig({
                borderColor: 'black',
                shadowColor: 'gray'
              })
            }
          },
          'test-classes-style-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Classes Style Widget'
            },
            styles: {
              add: classesStyleConfig()
            }
          },
          'test-media-query-style-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Media Query Style Widget'
            },
            styles: {
              add: mediaQueryStyleConfig()
            }
          },
          'test-value-template-style-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Value Template Style Widget'
            },
            styles: {
              add: {
                ...valueTemplateStyleConfig(),
                ...boxValueTemplateConfig()
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
      const actual = await apos.styles.getStylesheet(
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
      const styles = actual.css;
      const actualChecks = {
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
      assert.deepEqual(actualChecks, {
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
      const actual = await apos.modules['test-widget'].getStylesheet(
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
      const styles = actual.css;
      const actualChecks = {
        selector: styles.startsWith('#randomStyleId .border-style{'),
        selectorEnd: styles.endsWith('}'),
        borderWidth: styles.includes('border-width: 3px'),
        borderWidthTop: styles.includes('border-width-top: 3px'),
        borderWidthRight: styles.includes('border-width-right: 3px'),
        borderWidthBottom: styles.includes('border-width-bottom: 3px'),
        borderWidthLeft: styles.includes('border-width-left: 3px'),
        borderRadius: styles.includes('border-radius: 12px;'),
        borderColor: styles.includes('border-color: blue;'),
        borderStyle: styles.includes('border-style: dotted;')
      };
      assert.deepEqual(actualChecks, {
        selector: true,
        selectorEnd: true,
        borderWidth: true,
        borderWidthTop: false,
        borderWidthRight: false,
        borderWidthBottom: false,
        borderWidthLeft: false,
        borderRadius: true,
        borderColor: true,
        borderStyle: true
      });
    });

    it('should render object as inline style correctly (widgets)', async function () {
      const actual = await apos.modules['test-inline-style-widget'].getStylesheet(
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
      assert.equal(actual.css, '');

      const styles = actual.inline;
      const actualChecks = {
        selector: !styles.includes('#randomStyleId{'),
        isInline: !styles.includes('{') && !styles.includes('}'),
        borderWidth: styles.includes('border-width: 3px'),
        borderRadius: styles.includes('border-radius: 12px;'),
        borderColor: styles.includes('border-color: blue;'),
        borderStyle: styles.includes('border-style: dotted;')
      };
      assert.deepEqual(actualChecks, {
        selector: true,
        isInline: true,
        borderWidth: true,
        borderRadius: true,
        borderColor: true,
        borderStyle: true
      });
    });

    it('should extract classes from the styles schema (@apostrophecms/styles)', async function () {
      const actual = apos.styles.getStylesheet(
        {
          alignSelect: 'apos-center',
          leftBoolean: true,
          checkboxes: [ 'rounded-corners', 'shadow' ]
        }
      );
      const classes = actual.classes;
      assert.deepEqual(classes.sort(), [
        'apos-center',
        'apos-left',
        'rounded-corners',
        'shadow'
      ].sort()
      );
    });

    it('should extract classes from the styles schema (widget)', async function () {
      const actual = apos.modules['test-classes-style-widget'].getStylesheet(
        {
          alignSelect: 'apos-center',
          leftBoolean: true,
          checkboxes: [ 'rounded-corners', 'shadow' ]
        },
        'randomStyleId'
      );
      assert.equal(actual.css, '');
      assert.equal(actual.inline, '');

      const classes = actual.classes;
      assert.deepEqual(classes.sort(), [
        'apos-center',
        'apos-left',
        'rounded-corners',
        'shadow'
      ].sort()
      );
    });

    it('should render media query styles correctly (@apostrophecms/styles)', async function () {
      const actual = apos.styles.getStylesheet(
        {
          responsivePadding: {
            mobile: 4,
            tablet: 8,
            desktop: 12
          }
        }
      );
      assert.equal(actual.inline, undefined);
      assert.deepEqual(actual.classes, []);
      const styles = actual.css;
      assert.equal(
        styles,
        '@media (width > 1200px){.responsive-padding{padding: 12px;}}' +
        '@media (560px < width <= 1200px){.responsive-padding{padding: 8px;}}' +
        '@media (width <= 560px){.responsive-padding{padding: 4px;}}'
      );
    });

    it('should render media query styles correctly (widget)', async function () {
      const actual = apos.modules['test-media-query-style-widget'].getStylesheet(
        {
          responsivePadding: {
            mobile: 2,
            tablet: 6,
            desktop: 10
          }
        },
        'randomStyleId'
      );
      assert.equal(actual.inline, '');
      assert.deepEqual(actual.classes, []);
      const styles = actual.css;
      assert.equal(
        styles,
        '@media (width > 1200px){#randomStyleId .responsive-padding{padding: 10px;}}' +
        '@media (560px < width <= 1200px){#randomStyleId .responsive-padding{padding: 6px;}}' +
        '@media (width <= 560px){#randomStyleId .responsive-padding{padding: 2px;}}'
      );
    });

    it('should render value template styles correctly (@apostrophecms/styles)', async function () {
      {
        const actual = apos.styles.getStylesheet(
          {
            boxShadow: {
              active: true,
              x: 3,
              y: 3,
              blur: 6,
              color: 'rgba(0,0,0,0.4)',
              standalone: 10
            }
          }
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '.box-shadow{box-shadow: 3px 3px 6px rgba(0,0,0,0.4);width: 10px;}',
          'Output CSS does not match expected value template output when active'
        );
      }

      {
        const actual = apos.styles.getStylesheet(
          {
            boxShadow: {
              active: false,
              x: 5,
              y: 5,
              blur: 10,
              color: 'rgba(0,0,0,0.5)',
              standalone: 15
            }
          }
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '.box-shadow{width: 15px;}',
          'Output CSS does not match expected value template output when inactive'
        );
      }

      // Test `%box.value%` interpolation support
      {
        const actual = apos.styles.getStylesheet(
          {
            position: {
              active: true,
              box: {
                top: 10,
                right: 15,
                bottom: 20,
                left: 25
              }
            }
          }
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '.box-position{inset: 10px 15px 20px 25px;}',
          'Output CSS does not match expected %box.value% template output'
        );
      }

      // Test `%box.value%` interpolation when inactive
      {
        const actual = apos.styles.getStylesheet(
          {
            position: {
              active: false,
              box: {
                top: 10,
                right: 15,
                bottom: 20,
                left: 25
              }
            }
          }
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '',
          'Output CSS does not match expected %box.value% template output'
        );
      }
    });

    it('should render value template styles correctly (widget)', async function () {
      {
        const actual = apos.modules['test-value-template-style-widget'].getStylesheet(
          {
            boxShadow: {
              active: true,
              x: 4,
              y: 5,
              blur: 8,
              color: 'rgba(0,0,0,0.6)',
              standalone: 12
            }
          },
          'randomStyleId'
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '#randomStyleId .box-shadow{box-shadow: 4px 5px 8px rgba(0,0,0,0.6);width: 12px;}',
          'Output CSS does not match expected value template output when active'
        );
      }

      {
        const actual = apos.modules['test-value-template-style-widget'].getStylesheet(
          {
            boxShadow: {
              active: false,
              x: 6,
              y: 7,
              blur: 12,
              color: 'rgba(0,0,0,0.7)',
              standalone: 18
            }
          },
          'randomStyleId'
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '#randomStyleId .box-shadow{width: 18px;}',
          'Output CSS does not match expected value template output when inactive'
        );
      }

      // Test `%box.value%` interpolation support
      {
        const actual = apos.modules['test-value-template-style-widget'].getStylesheet(
          {
            position: {
              active: true,
              box: {
                top: 10,
                right: 15,
                bottom: 20,
                left: 25
              }
            }
          },
          'randomStyleId'
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '#randomStyleId .box-position{inset: 10px 15px 20px 25px;}',
          'Output CSS does not match expected %box.value% template output'
        );
      }

      // Test `%box.value%` interpolation disabled when inactive
      {
        const actual = apos.modules['test-value-template-style-widget'].getStylesheet(
          {
            position: {
              active: false,
              box: {
                top: 10,
                right: 15,
                bottom: 20,
                left: 25
              }
            }
          },
          'randomStyleId'
        );
        const styles = actual.css;
        assert.deepEqual(actual.classes, []);
        assert.equal(
          styles,
          '',
          'Output CSS does not match expected %box.value% template output when inactive'
        );
      }
    });
  });

  describe('Conditional styles', function () {
    let apos;

    const conditionalStylesSchema = () => ({
      parentActive: {
        type: 'boolean',
        def: false
      },
      textColor: {
        label: 'Text Color',
        type: 'color',
        property: '--color',
        selector: ':root'
      },
      backgroundColor: {
        label: 'Background Color',
        type: 'color',
        property: '--background-color',
        selector: ':root',
        if: {
          parentActive: true
        }
      },
      highlightColor: {
        label: 'Highlight Color',
        type: 'color',
        property: '--highlight-color',
        selector: ':root',
        if: {
          backgroundColor: '#000000'
        }
      },
      border: {
        type: 'object',
        selector: '.border-style',
        fields: {
          add: {
            active: {
              type: 'boolean',
              def: false
            },
            width: {
              type: 'box',
              def: {
                top: 1,
                right: 1,
                bottom: 1,
                left: 1
              },
              if: {
                active: true,
                '<parentActive': true
              },
              unit: 'px',
              property: 'border-width'
            },
            color: {
              type: 'color',
              if: {
                active: true
              },
              property: 'border-color'
            }
          }
        }
      },
      anotherBorder: {
        type: 'object',
        selector: '.another-border-style',
        fields: {
          add: {
            color: {
              type: 'color',
              property: 'border-color',
              if: {
                '<border.active': true
              }
            }
          }
        }
      }
    });

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/styles': {
            styles: {
              add: conditionalStylesSchema()
            }
          },
          'test-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Widget'
            },
            styles: {
              add: conditionalStylesSchema()
            }
          }
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('should support conditional style fields (@apostrophecms/styles)', async function () {
      {
        const actual = await apos.styles.getStylesheet(
          {
            parentActive: false,
            border: {
              active: false,
              width: {
                top: 2,
                right: 4,
                bottom: 2,
                left: 4
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#000000',
            highlightColor: 'yellow'
          }
        );
        assert.equal(
          actual.css,
          ':root{--color: blue;--highlight-color: yellow;}',
          'Output CSS does not match expected with `parentActive: false` and `border.active: false`'
        );
      }

      {
        const actual = await apos.styles.getStylesheet(
          {
            parentActive: true,
            border: {
              active: false,
              width: {
                top: 2,
                right: 2,
                bottom: 2,
                left: 2
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#ffffff',
            highlightColor: 'yellow'
          }
        );
        assert.equal(
          actual.css,
          ':root{--color: blue;--background-color: #ffffff;}',
          'Output CSS does not match expected with `parentActive: true` and `border.active: false`'
        );
      }

      {
        const actual = await apos.styles.getStylesheet(
          {
            parentActive: false,
            border: {
              active: true,
              width: {
                top: 3,
                right: 3,
                bottom: 3,
                left: 3
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#000000',
            highlightColor: 'yellow'
          }
        );
        assert.equal(
          actual.css,
          ':root{--color: blue;--highlight-color: yellow;}.border-style{border-color: red;}.another-border-style{border-color: green;}',
          'Output CSS does not match expected with `parentActive: false` and `border.active: true`'
        );
      }

      {
        const actual = await apos.styles.getStylesheet(
          {
            parentActive: true,
            border: {
              active: true,
              width: {
                top: 4,
                right: 4,
                bottom: 4,
                left: 4
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#000000',
            highlightColor: 'yellow'
          }
        );
        assert.equal(
          actual.css,
          ':root{--color: blue;--background-color: #000000;--highlight-color: yellow;}' +
          '.border-style{border-width: 4px;border-color: red;}' +
          '.another-border-style{border-color: green;}',
          'Output CSS does not match expected with `parentActive: true` and `border.active: true`'
        );
      }
    });

    it('should support conditional style fields (widgets)', async function () {
      const rootId = 'testWidgetId';
      const rootSelector = `#${rootId}`;

      {
        const actual = await apos.modules['test-widget'].getStylesheet(
          {
            parentActive: false,
            border: {
              active: false,
              width: {
                top: 2,
                right: 4,
                bottom: 2,
                left: 4
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#000000',
            highlightColor: 'yellow'
          },
          rootId
        );
        assert.equal(
          actual.css,
          `${rootSelector} :root{--color: blue;--highlight-color: yellow;}`,
          'Output CSS does not match expected with `parentActive: false` and `border.active: false`'
        );
      }

      {
        const actual = await apos.modules['test-widget'].getStylesheet(
          {
            parentActive: true,
            border: {
              active: false,
              width: {
                top: 2,
                right: 2,
                bottom: 2,
                left: 2
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#ffffff',
            highlightColor: 'yellow'
          },
          rootId
        );
        assert.equal(
          actual.css,
          `${rootSelector} :root{--color: blue;--background-color: #ffffff;}`,
          'Output CSS does not match expected with `parentActive: true` and `border.active: false`'
        );
      }

      {
        const actual = await apos.modules['test-widget'].getStylesheet(
          {
            parentActive: false,
            border: {
              active: true,
              width: {
                top: 3,
                right: 3,
                bottom: 3,
                left: 3
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#000000',
            highlightColor: 'yellow'
          },
          rootId
        );
        assert.equal(
          actual.css,
          `${rootSelector} :root{--color: blue;--highlight-color: yellow;}` +
          `${rootSelector} .border-style{border-color: red;}` +
          `${rootSelector} .another-border-style{border-color: green;}`,
          'Output CSS does not match expected with `parentActive: false` and `border.active: true`'
        );
      }

      {
        const actual = await apos.modules['test-widget'].getStylesheet(
          {
            parentActive: true,
            border: {
              active: true,
              width: {
                top: 4,
                right: 4,
                bottom: 4,
                left: 4
              },
              color: 'red'
            },
            anotherBorder: {
              color: 'green'
            },
            textColor: 'blue',
            backgroundColor: '#000000',
            highlightColor: 'yellow'
          },
          rootId
        );
        assert.equal(
          actual.css,
          `${rootSelector} :root{--color: blue;--background-color: #000000;--highlight-color: yellow;}` +
          `${rootSelector} .border-style{border-width: 4px;border-color: red;}` +
          `${rootSelector} .another-border-style{border-color: green;}`,
          'Output CSS does not match expected with `parentActive: true` and `border.active: true`'
        );
      }
    });
  });

  describe('Render styles helpers', function () {
    let apos;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          'test-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'Test Widget'
            },
            styles: {
              add: {
                // Produces CSS output
                borderColor: {
                  type: 'color',
                  property: 'border-color',
                  selector: '.border'
                },
                // Produces inline output (no selector)
                backgroundColor: {
                  type: 'color',
                  property: 'background-color'
                },
                // Produces class output
                alignment: {
                  type: 'select',
                  class: true,
                  choices: [
                    {
                      label: 'None',
                      value: ''
                    },
                    {
                      label: 'Left',
                      value: 'align-left'
                    },
                    {
                      label: 'Center',
                      value: 'align-center'
                    }
                  ],
                  def: ''
                }
              }
            }
          },
          'no-styles-widget': {
            extend: '@apostrophecms/widget-type',
            options: {
              label: 'No Styles Widget'
            }
          }
        }
      });
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('should prepare, render elements, and render attributes for widget with all style types', function () {
      const widget = {
        _id: 'widget123',
        metaType: 'widget',
        type: 'test',
        borderColor: 'red',
        backgroundColor: 'blue',
        alignment: 'align-left'
      };

      // Step 1: prepareWidgetStyles
      const styles = apos.styles.prepareWidgetStyles(widget);

      const stylesExpected = {
        hasStyleId: !!styles.styleId,
        widgetId: styles.widgetId,
        hasCss: !!styles.css,
        hasInline: !!styles.inline,
        hasCssColor: styles.css.includes('border-color: red'),
        hasCssBackground: styles.css.includes('background-color: blue'),
        hasClasses: styles.classes.includes('align-left')
      };
      assert.deepEqual(stylesExpected, {
        hasStyleId: true,
        widgetId: 'widget123',
        hasCss: true,
        hasInline: false,
        hasCssColor: true,
        hasCssBackground: true,
        hasClasses: true
      }, 'prepareWidgetStyles should return correct styles object');

      // Step 2: getWidgetElements consumes styles
      const elements = apos.styles.getWidgetElements(styles);

      const elementsExpected = {
        referencesStyleId: elements.includes(`data-apos-widget-style-for="${styles.styleId}"`),
        containsCss: elements.includes('border-color: red')
      };
      assert.deepEqual(elementsExpected, {
        referencesStyleId: true,
        containsCss: true
      }, 'getWidgetElements should render style element correctly');

      // Step 3: getWidgetAttributes consumes styles
      const attributes = apos.styles.getWidgetAttributes(styles);

      const attributesExpected = {
        hasId: attributes.includes(`id="${styles.styleId}"`),
        hasDataAttr: attributes.includes(`data-apos-widget-style-wrapper-for="${styles.widgetId}"`),
        hasClasses: attributes.includes('class="align-left"'),
        hasNoInlineStyle: !attributes.includes('style=')
      };
      assert.deepEqual(attributesExpected, {
        hasId: true,
        hasDataAttr: true,
        hasClasses: true,
        hasNoInlineStyle: true
      }, 'getWidgetAttributes should render attributes correctly');
    });

    it('should handle widget with only css output (no inline, no classes)', function () {
      const widget = {
        _id: 'widget-css-only',
        metaType: 'widget',
        type: 'test',
        borderColor: 'green'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const elements = apos.styles.getWidgetElements(styles);
      const attributes = apos.styles.getWidgetAttributes(styles);

      const actualChecks = {
        elementContainsCss: elements.includes('border-color: green'),
        attributesHasId: attributes.includes(`id="${styles.styleId}"`),
        attributesHasNoClass: !attributes.includes('class='),
        attributesHasNoStyle: !attributes.includes('style=')
      };
      assert.deepEqual(actualChecks, {
        elementContainsCss: true,
        attributesHasId: true,
        attributesHasNoClass: true,
        attributesHasNoStyle: true
      }, 'widget with only css should produce correct output');
    });

    it('should handle widget with only inline output (no css, no classes)', function () {
      const widget = {
        _id: 'widget-inline-only',
        metaType: 'widget',
        type: 'test',
        backgroundColor: 'yellow'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const elements = apos.styles.getWidgetElements(styles);
      const attributes = apos.styles.getWidgetAttributes(styles);
      assert.equal(elements, '', 'elements should be empty (no css)');
      assert(
        attributes.includes('style="background-color: yellow'),
        'attributes should have inline style'
      );
      assert(!attributes.includes('class='), 'attributes should not have class');
    });

    it('should handle widget with only class output (no css, no inline)', function () {
      const widget = {
        _id: 'widget-class-only',
        metaType: 'widget',
        type: 'test',
        alignment: 'align-center'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const elements = apos.styles.getWidgetElements(styles);
      const attributes = apos.styles.getWidgetAttributes(styles);

      assert.equal(elements, '', 'elements should be empty (no css)');
      assert(attributes.includes('class="align-center"'), 'attributes should have class');
      assert(!attributes.includes('style='), 'attributes should not have inline style');
    });

    it('should handle widget with no style values', function () {
      const widget = {
        _id: 'widget-no-styles',
        metaType: 'widget',
        type: 'no-styles'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const elements = apos.styles.getWidgetElements(styles);
      const attributes = apos.styles.getWidgetAttributes(styles);

      const actualChecks = {
        hasStyleId: !!styles.styleId,
        widgetId: styles.widgetId,
        elementsEmpty: elements === '',
        attributesHasId: attributes.includes(`id="${styles.styleId}"`),
        attributesHasNoClass: !attributes.includes('class='),
        attributesHasNoStyle: !attributes.includes('style=')
      };
      assert.deepEqual(actualChecks, {
        hasStyleId: true,
        widgetId: 'widget-no-styles',
        elementsEmpty: true,
        attributesHasId: true,
        attributesHasNoClass: true,
        attributesHasNoStyle: true
      }, 'widget with no styles should produce correct output');
    });

    it('should return empty styles object from prepareWidgetStyles for unknown widget type', function () {
      const widget = {
        _id: 'widget-unknown',
        metaType: 'widget',
        type: 'unknown'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);

      assert.deepEqual(styles, {
        styleId: '',
        widgetId: '',
        css: '',
        inline: '',
        classes: []
      }, 'should return empty styles object');
    });

    it('should generate unique styleId for each prepareWidgetStyles call', function () {
      const widget = {
        _id: 'widget-unique',
        metaType: 'widget',
        type: 'test'
      };

      const styles1 = apos.styles.prepareWidgetStyles(widget);
      const styles2 = apos.styles.prepareWidgetStyles(widget);

      assert.notEqual(styles1.styleId, styles2.styleId, 'styleIds should be unique');
    });

    it('should merge additional attributes with prepared styles', function () {
      const widget = {
        _id: 'widget-merge',
        metaType: 'widget',
        type: 'test',
        backgroundColor: 'blue',
        alignment: 'align-left'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const additionalAttrs = {
        class: 'custom-class',
        style: 'margin: 10px',
        'data-testid': 'my-widget',
        'aria-label': 'Custom Widget'
      };

      const attributes = apos.styles.getWidgetAttributes(styles, additionalAttrs);
      const actualChecks = {
        mergedClasses: attributes.includes('class="align-left custom-class"'),
        mergedStyles: attributes.includes('style="background-color: blue;margin: 10px;"'),
        hasDataTestId: attributes.includes('data-testid="my-widget"'),
        hasAriaLabel: attributes.includes('aria-label="Custom Widget"')
      };
      assert.deepEqual(actualChecks, {
        mergedClasses: true,
        mergedStyles: true,
        hasDataTestId: true,
        hasAriaLabel: true
      }, 'additional attributes should be merged correctly');
    });

    it('should deduplicate classes when merging additional attributes', function () {
      const widget = {
        _id: 'widget-dedup',
        metaType: 'widget',
        type: 'test',
        alignment: 'align-left'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const additionalAttrs = {
        class: 'align-left extra-class'
      };

      const attributes = apos.styles.getWidgetAttributes(styles, additionalAttrs);

      assert(attributes.includes('class="align-left extra-class"'), 'should deduplicate classes');
      assert.equal(
        (attributes.match(/align-left/g) || []).length,
        1,
        'align-left should appear only once'
      );
    });

    it('should handle additional attributes as array for classes', function () {
      const widget = {
        _id: 'widget-array-class',
        metaType: 'widget',
        type: 'test',
        alignment: 'align-center'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const additionalAttrs = {
        class: [ 'extra1', 'extra2' ]
      };

      const attributes = apos.styles.getWidgetAttributes(styles, additionalAttrs);

      assert(attributes.includes('class="align-center extra1 extra2"'), 'should merge array classes');
    });

    it('should add additional attributes when styles have no classes or inline', function () {
      const widget = {
        _id: 'widget-add-attrs',
        metaType: 'widget',
        type: 'no-styles'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const additionalAttrs = {
        class: 'added-class',
        style: 'color: red',
        'data-custom': 'value'
      };

      const attributes = apos.styles.getWidgetAttributes(styles, additionalAttrs);
      const actualChecks = {
        hasClass: attributes.includes('class="added-class"'),
        hasStyle: attributes.includes('style="color: red;"'),
        hasCustomAttr: attributes.includes('data-custom="value"')
      };
      assert.deepEqual(actualChecks, {
        hasClass: true,
        hasStyle: true,
        hasCustomAttr: true
      }, 'additional attributes should be added when styles have none');
    });

    it('should ignore null and undefined values in additional attributes', function () {
      const widget = {
        _id: 'widget-null-attrs',
        metaType: 'widget',
        type: 'test'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const additionalAttrs = {
        'data-null': null,
        'data-undefined': undefined,
        'data-valid': 'value'
      };

      const attributes = apos.styles.getWidgetAttributes(styles, additionalAttrs);

      const actualChecks = {
        hasNoNullAttr: !attributes.includes('data-null'),
        hasNoUndefinedAttr: !attributes.includes('data-undefined'),
        hasValidAttr: attributes.includes('data-valid="value"')
      };
      assert.deepEqual(actualChecks, {
        hasNoNullAttr: true,
        hasNoUndefinedAttr: true,
        hasValidAttr: true
      }, 'null and undefined attribute values should be ignored');
    });

    it('should filter empty strings from additional classes', function () {
      const widget = {
        _id: 'widget-filter-empty',
        metaType: 'widget',
        type: 'test',
        alignment: 'align-right'
      };

      const styles = apos.styles.prepareWidgetStyles(widget);
      const additionalAttrs = {
        class: '  extra1   extra2  '
      };

      const attributes = apos.styles.getWidgetAttributes(styles, additionalAttrs);

      assert(attributes.includes('class="align-right extra1 extra2"'), 'should filter empty strings');
    });

    describe('edge cases for getWidgetElements', function () {
      it('should return empty string for null input', function () {
        assert.equal(apos.styles.getWidgetElements(null), '');
      });

      it('should return empty string for undefined input', function () {
        assert.equal(apos.styles.getWidgetElements(undefined), '');
      });

      it('should return empty string when css is missing', function () {
        assert.equal(apos.styles.getWidgetElements({ styleId: 'test' }), '');
      });

      it('should return empty string when styleId is missing', function () {
        assert.equal(apos.styles.getWidgetElements({ css: '.test{}' }), '');
      });

      it('should return empty string when css is empty', function () {
        assert.equal(apos.styles.getWidgetElements({
          css: '',
          styleId: 'test'
        }), '');
      });
    });

    describe('edge cases for getWidgetAttributes', function () {
      it('should return empty string for null input', function () {
        assert.equal(apos.styles.getWidgetAttributes(null), '');
      });

      it('should return empty string for undefined input', function () {
        assert.equal(apos.styles.getWidgetAttributes(undefined), '');
      });

      it('should return empty string when styleId is missing', function () {
        assert.equal(apos.styles.getWidgetAttributes({ classes: [ 'test' ] }), '');
      });

      it('should handle missing widgetId', function () {
        const result = apos.styles.getWidgetAttributes({ styleId: 'test' });
        assert(result.includes('data-apos-widget-style-wrapper-for=""'));
      });

      it('should handle empty classes array', function () {
        const result = apos.styles.getWidgetAttributes({
          classes: [],
          styleId: 'test',
          widgetId: 'w1'
        });
        assert(!result.includes('class='));
      });

      it('should handle empty additional attributes object', function () {
        const result = apos.styles.getWidgetAttributes({
          classes: [ 'c1' ],
          inline: 'color: red',
          styleId: 'test',
          widgetId: 'w1'
        }, {});
        assert(
          result.includes('class="c1"'),
          'should include class c1'
        );
        assert(
          result.includes('style="color: red;"'),
          'should include inline style'
        );
      });
    });
  });

  describe('Nunjucks helpers (stylesWrapper: false)', function () {
    let apos;
    let page;
    let jar;

    before(async function () {
      apos = await t.create({
        root: module,
        modules: {
          // A page that uses the test-style-widget
          'test-style-page': {},
          'test-style-widget': {
            options: {
              stylesWrapper: false
            },
            styles: {
              add: {
                // Produces CSS output
                borderColor: {
                  type: 'color',
                  property: 'border-color',
                  selector: '.border'
                },
                // Produces inline output (no selector)
                backgroundColor: {
                  type: 'color',
                  property: 'background-color'
                },
                // Produces class output
                alignment: {
                  type: 'select',
                  class: true,
                  choices: [
                    {
                      label: 'None',
                      value: ''
                    },
                    {
                      label: 'Left',
                      value: 'align-left'
                    },
                    {
                      label: 'Center',
                      value: 'align-center'
                    }
                  ],
                  def: ''
                }
              }
            }
          }
        }
      });

      // Add a test page to work with
      const req = apos.task.getReq();
      const input = {
        slug: '/test-styles',
        type: 'test-style-page',
        title: 'Test Styles Page',
        metaType: 'doc'
      };
      const instance = apos.util.getManagerOf(input).newInstance();
      page = await apos.doc.insert(req, {
        ...instance,
        ...input
      });
      assert.equal(page.aposMode, 'published');
      assert.equal(page.slug, input.slug);

      jar = apos.http.jar();
    });

    after(async function () {
      return t.destroy(apos);
    });

    it('should render styles helpers correctly in widget template (css)', async function () {
      const updated = await apos.doc.update(apos.task.getReq(), {
        ...page,
        body: {
          ...page.body,
          items: [
            {
              type: 'test-style',
              borderColor: 'red',
              backgroundColor: 'blue',
              alignment: 'align-left',
              metaType: 'widget'
            }
          ]
        }
      });
      const widget = updated.body.items[0];
      const res = await apos.http.get('/test-styles', { jar });
      const styleIdMatch = res.match(/data-apos-widget-style-for="([^"]+)"/);
      const styleId = styleIdMatch ? styleIdMatch[1] : null;

      const actual = {
        hasStyleId: !!styleId,
        hasWidgetId: !!widget._id,
        hasStyleElement: res
          .includes(`<style data-apos-widget-style-for="${styleId}">`),
        hasBorderCss: res
          .includes(`#${styleId} .border{border-color: red;}`),
        hasBackgroundColorCss: res
          .includes(`#${styleId}{background-color: blue;}`),
        hasWrapper: res
          .includes(`<article id="${styleId}" data-apos-widget-style-wrapper-for="${widget._id}" class="align-left fancy-article">`),
        closesWrapper: res
          .includes('</article>')
      };

      assert.deepEqual(actual, {
        hasStyleId: true,
        hasWidgetId: true,
        hasStyleElement: true,
        hasBorderCss: true,
        hasBackgroundColorCss: true,
        hasWrapper: true,
        closesWrapper: true
      }, 'Nunjucks helpers should render correctly in widget template');
    });

    it('should render styles helpers correctly in widget template (no styles)', async function () {
      const updated = await apos.doc.update(apos.task.getReq(), {
        ...page,
        body: {
          ...page.body,
          items: [
            {
              type: 'test-style',
              metaType: 'widget'
            }
          ]
        }
      });
      const widget = updated.body.items[0];
      const res = await apos.http.get('/test-styles', { jar });
      const styleIdMatch = res.match(/id="([^"]+)"/);
      const styleId = styleIdMatch ? styleIdMatch[1] : null;

      const actual = {
        hasStyleId: !!styleId,
        hasWidgetId: !!widget._id,
        hasStyleElement: res
          .includes(`<style data-apos-widget-style-for="${styleId}">`),
        hasWrapper: res
          .includes(`<article id="${styleId}" data-apos-widget-style-wrapper-for="${widget._id}" class="fancy-article">`),
        closesWrapper: res
          .includes('</article>')
      };

      assert.deepEqual(actual, {
        hasStyleId: true,
        hasWidgetId: true,
        hasStyleElement: false,
        hasWrapper: true,
        closesWrapper: true
      }, 'Nunjucks helpers should render correctly in widget template with no styles');
    });

    it('should render styles helpers correctly in widget template (inline)', async function () {
      const updated = await apos.doc.update(apos.task.getReq(), {
        ...page,
        body: {
          ...page.body,
          items: [
            {
              type: 'test-style',
              backgroundColor: 'blue',
              metaType: 'widget'
            }
          ]
        }
      });
      const widget = updated.body.items[0];
      const res = await apos.http.get('/test-styles', { jar });
      const styleIdMatch = res.match(/id="([^"]+)"/);
      const styleId = styleIdMatch ? styleIdMatch[1] : null;

      const actual = {
        hasStyleId: !!styleId,
        hasWidgetId: !!widget._id,
        hasStyleElement: res
          .includes(`<style data-apos-widget-style-for="${styleId}">`),
        hasBackgroundColorCss: res
          .includes(`#${styleId}{background-color: blue;}`),
        hasBackgroundColorInline: res
          .includes('style="background-color: blue;"'),
        hasWrapper: res
          .includes(`<article id="${styleId}" data-apos-widget-style-wrapper-for="${widget._id}" class="fancy-article" style="background-color: blue;">`),
        closesWrapper: res
          .includes('</article>')
      };

      assert.deepEqual(actual, {
        hasStyleId: true,
        hasWidgetId: true,
        hasStyleElement: false,
        hasBackgroundColorCss: false,
        hasBackgroundColorInline: true,
        hasWrapper: true,
        closesWrapper: true
      }, 'Nunjucks helpers should render correctly in widget template with inline styles');
    });
  });
});
