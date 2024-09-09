const t = require('../test-lib/test.js');
const assert = require('assert');

let cleanup = [];

after(async () => {
  for (const apos of cleanup) {
    await t.destroy(apos);
  }
});

describe('add missing schema fields', function() {

  this.timeout(t.timeout);

  it('can set up and insert a piece normally', async function() {
    const apos = await t.create({
      root: module,
      shortName: 'amsf',
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
              }
            }
          }
        }
      }
    });
    const product = apos.product.newInstance();
    product.title = 'Product 1';
    // Intentionally not equal to the default
    product.price = 15;
    const req = apos.task.getReq();
    const result = await apos.product.insert(req, product);
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
    }
    cleanup.push(apos);
  });

  it('can set up with an expanded schema and see the default value automatically added', async function() {
    const apos = await t.create({
      root: module,
      // Same on purpose so we reuse the database
      shortName: 'amsf',
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
              code: {
                type: 'integer',
                required: true,
                def: 20
              }
            }
          }
        }
      }
    });
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
    }
    cleanup.push(apos);
  });

});
