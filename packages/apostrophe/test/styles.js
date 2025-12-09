const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Styles', function () {
  let apos;

  this.timeout(t.timeout);

  before(async function () {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/styles': {
          styles(self, options) {
            return {
              add: {
                border: 'border',
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
