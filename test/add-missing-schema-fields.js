const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');

const cleanup = [];

after(async () => {
  for (const apos of cleanup) {
    await t.destroy(apos);
  }
});

describe('add missing schema fields', function() {

  this.timeout(t.timeout);

  it('first generation & sanity checks', async function() {
    const apos = await t.create({
      root: module,
      shortName: 'test-amsf',
      modules: {
        product: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'product'
          },
          fields: {
            add: {
              price: {
                type: 'integer',
                required: true,
                def: 10
              },
              body: {
                type: 'area',
                widgets: {
                  hero: {},
                  '@apostrophecms/rich-text': {}
                }
              }
            }
          }
        },
        'hero-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              label: {
                type: 'string'
              }
            }
          }
        }
      }
    });
    cleanup.push(apos);
    const product = apos.product.newInstance();
    product.title = 'Product 1';
    // Intentionally not equal to the default
    product.price = 15;
    product.body = {
      metaType: 'area',
      items: [
        {
          type: 'hero',
          label: 'Sample Label'
        }
      ]
    };
    const req = apos.task.getReq();
    await apos.product.insert(req, product);
    const products = await apos.doc.db.find({
      type: 'product'
    }).sort({
      aposMode: 1
    }).toArray();
    assert.strictEqual(products.length, 2);
    for (const product of products) {
      // Not a thing yet
      assert.strictEqual(product.code, undefined);
      assert.strictEqual(product.title, 'Product 1');
      assert.strictEqual(product.price, 15);
      assert.strictEqual(product.body.items[0].label, 'Sample Label');
    }
  });

  it('second generation schema (objects, arrays, new widget fields)', async function() {
    const apos = await t.create({
      root: module,
      // Same on purpose so we reuse the database
      shortName: 'test-amsf',
      modules: {
        product: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'product'
          },
          fields: {
            add: {
              price: {
                type: 'float',
                required: true
              },
              body: {
                type: 'area',
                widgets: {
                  hero: {},
                  '@apostrophecms/rich-text': {}
                }
              },
              code: {
                type: 'integer',
                required: true,
                def: 20
              },
              attitude: {
                // Test the fallback default of the type
                type: 'string'
              },
              addresses: {
                type: 'array',
                fields: {
                  add: {
                    street: {
                      type: 'string'
                    }
                  }
                }
              },
              flavors: {
                type: 'object',
                fields: {
                  add: {
                    chocolate: {
                      type: 'boolean',
                      def: true
                    },
                    vanilla: {
                      type: 'boolean',
                      def: false
                    },
                    strawberry: {
                      type: 'boolean'
                      // should get fallback default
                    }
                  }
                }
              }
            }
          }
        },
        'hero-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              label: {
                type: 'string'
              },
              // New properties, with defaults
              sublabel: {
                type: 'string',
                def: 'Default Sublabel'
              },
              specialized: {
                type: 'boolean',
                def: false
              }
            }
          }
        }
      }
    });
    cleanup.push(apos);
    const products = await apos.doc.db.find({
      type: 'product'
    }).sort({
      aposMode: 1
    }).toArray();
    assert.strictEqual(products.length, 2);
    for (const product of products) {
      assert.strictEqual(product.code, 20);
      assert.strictEqual(product.title, 'Product 1');
      // Still unchanged from existing non-default value
      assert.strictEqual(product.price, 15);
      assert.strictEqual(product.attitude, '');
      assert(_.isEqual(product.addresses, []));
      assert.strictEqual(product.flavors.chocolate, true);
      assert.strictEqual(product.flavors.vanilla, false);
      // Type has no fallback default (update test if this changes)
      assert.strictEqual(product.flavors.strawberry, undefined);
      assert.strictEqual(product.body.items[0].label, 'Sample Label');
      assert.strictEqual(product.body.items[0].sublabel, 'Default Sublabel');
      assert.strictEqual(product.body.items[0].specialized, false);
    }
    const product = products.find(product => product.aposMode === 'draft');
    const req = apos.task.getReq({
      mode: 'draft'
    });
    product.addresses.push({
      street: '1168 E Passyunk Ave'
    });
    const result = await apos.product.update(req, product);
    await apos.product.publish(req, result);
    assert.strictEqual(result.addresses.length, 1);
    assert.strictEqual(result.addresses[0].street, '1168 E Passyunk Ave');
  });

  it('third generation schema (new array fields & verify new defaults do not crush existing values)', async function() {
    const apos = await t.create({
      root: module,
      // Same on purpose so we reuse the database
      shortName: 'test-amsf',
      modules: {
        product: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'product'
          },
          fields: {
            add: {
              price: {
                type: 'float',
                required: true
              },
              body: {
                type: 'area',
                widgets: {
                  hero: {},
                  '@apostrophecms/rich-text': {}
                }
              },
              code: {
                type: 'integer',
                required: true,
                def: 20
              },
              addresses: {
                type: 'array',
                fields: {
                  add: {
                    street: {
                      type: 'string'
                    },
                    city: {
                      type: 'string',
                      def: 'Philadelphia'
                    }
                  }
                }
              },
              flavors: {
                type: 'object',
                fields: {
                  add: {
                    chocolate: {
                      type: 'boolean',
                      def: true
                    },
                    vanilla: {
                      type: 'boolean',
                      // Verify change of default does NOT mess up an existing
                      // property
                      def: true
                    },
                    strawberry: {
                      type: 'boolean'
                      // should get fallback default
                    }
                  }
                }
              }
            }
          }
        },
        'hero-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              label: {
                type: 'string'
              },
              // New properties, with defaults
              sublabel: {
                type: 'string',
                def: 'Default Sublabel'
              },
              specialized: {
                type: 'boolean',
                def: false
              }
            }
          }
        }
      }
    });
    cleanup.push(apos);
    const products = await apos.doc.db.find({
      type: 'product',
      aposMode: {
        $in: [ 'draft', 'published' ]
      }
    }).sort({
      aposMode: 1
    }).toArray();
    assert.strictEqual(products.length, 2);
    for (const product of products) {
      assert.strictEqual(product.code, 20);
      assert.strictEqual(product.title, 'Product 1');
      assert.strictEqual(product.addresses.length, 1);
      // Should NOT change because it already has a value
      assert.strictEqual(product.flavors.vanilla, false);
      assert.strictEqual(product.addresses[0].street, '1168 E Passyunk Ave');
      assert.strictEqual(product.addresses[0].city, 'Philadelphia');
    }

    // Direct invocation to make sure an additional invocation with the same
    // schemas does no new work

    const { scans, updates } = await apos.migration.addMissingSchemaFields();
    assert.strictEqual(scans, 0);
    assert.strictEqual(updates, 0);
  });

});
