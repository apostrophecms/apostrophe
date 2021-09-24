// Bug report that motivated these tests:
//
// If products are related to salespeople, and salespeople have a reverse relationship
// back to products allowing that relationship to be viewed from the other end, everything
// works.
//
// But if products are also related to locations, the reverse relationship back from
// salespeople stops working.

const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Basic reverse relationships', function() {

  this.timeout(t.timeout);

  it('basic reverse relationship query works', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          product: {
            options: {
              alias: 'product'
            },
            extend: '@apostrophecms/piece-type',
            fields: {
              add: {
                _salespeople: {
                  type: 'relationship',
                  withType: 'salesperson'
                }
              }
            }
          },
          salesperson: {
            options: {
              alias: 'salesperson'
            },
            extend: '@apostrophecms/piece-type',
            fields: {
              add: {
                _products: {
                  type: 'relationshipReverse',
                  withType: 'product',
                  reverseOf: '_salespeople'
                }
              }
            }
          }
        }
      });

      const req = apos.task.getReq();
      const salesperson = await apos.salesperson.insert(req, {
        title: 'Willie Loman'
      });
      await apos.salesperson.insert(req, {
        title: 'Bernie Sanders'
      });
      await apos.product.insert(req, {
        title: 'Soap',
        _salespeople: [ salesperson ]
      });
      await apos.product.insert(req, {
        title: 'Rope'
      });
      const fetched = await apos.salesperson.find(req, {
        title: 'Willie Loman'
      }).toObject();
      assert(fetched);
      assert.strictEqual(fetched.title, 'Willie Loman');
      assert(fetched._products);
      assert.strictEqual(fetched._products.length, 1);
      assert.strictEqual(fetched._products[0].title, 'Soap');
    } finally {
      if (apos) {
        await t.destroy(apos);
      }
    }
  });
});

describe('Reverse relationships plus an extra relationship', function() {

  this.timeout(t.timeout);

  it('basic reverse relationship query works in the presence of an extra relationship with the types configured in an unexpected order', async function () {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          salesperson: {
            options: {
              alias: 'salesperson'
            },
            extend: '@apostrophecms/piece-type',
            fields: {
              add: {
                _products: {
                  type: 'relationshipReverse',
                  withType: 'product',
                  reverseOf: '_salespeople'
                }
              }
            }
          },
          location: {
            options: {
              alias: 'location'
            },
            extend: '@apostrophecms/piece-type'
          },
          product: {
            options: {
              alias: 'product'
            },
            extend: '@apostrophecms/piece-type',
            fields: {
              add: {
                _salespeople: {
                  type: 'relationship',
                  withType: 'salesperson'
                },
                _location: {
                  type: 'relationship',
                  withType: 'location'
                }
              }
            }
          }
        }
      });

      const req = apos.task.getReq();
      const salesperson = await apos.salesperson.insert(req, {
        title: 'Willie Loman'
      });
      await apos.salesperson.insert(req, {
        title: 'Bernie Sanders'
      });
      await apos.product.insert(req, {
        title: 'Soap',
        _salespeople: [ salesperson ]
      });
      await apos.product.insert(req, {
        title: 'Rope'
      });
      const fetched = await apos.salesperson.find(req, {
        title: 'Willie Loman'
      }).toObject();
      const soap = await apos.product.find(req, {
        title: 'Soap'
      }).toObject();
      assert(fetched);
      assert.strictEqual(fetched.title, 'Willie Loman');
      assert(fetched._products);
      assert.strictEqual(fetched._products.length, 1);
      assert.strictEqual(fetched._products[0].title, 'Soap');
      assert.strictEqual(soap.title, 'Soap');
      assert.strictEqual(soap._salespeople[0].title, 'Willie Loman');
    } finally {
      if (apos) {
        await t.destroy(apos);
      }
    }
  });
});
