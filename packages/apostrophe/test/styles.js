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
                borderCard: {
                  preset: 'border',
                  label: 'Card Border',
                  selector: '.card'
                }
              }
            };
          }
        },
        'test-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Test Widget',
            styles: {
              add: {
                border: 'border',
                backgroundColor: {
                  type: 'color',
                  required: true,
                  property: 'background-color'
                }
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

  it('should cascade styles', async function () {
    assert(apos.modules['test-widget'].styles, 'test-widget should have a styles property');
    assert(apos.styles.styles, '@apostrophecms/styles should have a styles property');
  });
});
