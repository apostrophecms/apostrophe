const t = require('../test-lib/test.js');
const assert = require('assert');

let apos;

describe('Draft / Published', function() {

  this.timeout(t.timeout);

  after(async function () {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize with a schema', async () => {
    apos = await t.create({
      root: module,

      modules: {
        '@apostrophecms/page': {
          options: {
            park: [],
            types: [
              {
                name: '@apostrophecms/home-page',
                label: 'Home'
              },
              {
                name: 'test-page',
                label: 'Test Page'
              }
            ]
          }
        },
        'test-page': {
          extend: '@apostrophecms/page-type'
        },
        product: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'product'
          },
          fields: {
            add: {
              body: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    '@apostrophecms/image': {}
                  }
                }
              },
              color: {
                type: 'select',
                choices: [
                  {
                    label: 'Red',
                    value: 'red'
                  },
                  {
                    label: 'Blue',
                    value: 'blue'
                  }
                ]
              },
              photo: {
                type: 'attachment',
                group: 'images'
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
              _articles: {
                type: 'relationship',
                withType: 'article',
                filters: {
                  projection: {
                    _url: 1,
                    title: 1
                  }
                },
                fields: {
                  add: {
                    relevance: {
                      // Explains the relevance of the article to the
                      // product in 1 sentence
                      type: 'string'
                    }
                  }
                }
              }
            }
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'article'
          },
          fields: {
            add: {
              name: {
                type: 'string'
              }
            }
          }
        }
      }
    });
  });

  let testDraftProduct;

  it('should be able to create and insert a draft product', async () => {
    const product = apos.product.newInstance();
    product.title = 'Test Product';
    testDraftProduct = await apos.product.insert(apos.task.getReq({
      mode: 'draft'
    }), product);
    assert(testDraftProduct.aposModified);
  });

  it('published should not exist yet', async () => {
    assert(!await apos.doc.db.findOne({
      _id: testDraftProduct._id.replace(':draft', ':published')
    }));
  });

  it('should be able to publish the product', async () => {
    await apos.product.publish(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
  });

  it('published product should exist and be the same', async () => {
    const product = await apos.product.find(apos.task.getReq({
      mode: 'published'
    }), {
      _id: testDraftProduct._id.replace(':draft', ':published')
    }).toObject();
    assert(product);
    assert(product.aposDocId === testDraftProduct.aposDocId);
    assert(product.aposLocale === 'en:published');
    assert(product.title === testDraftProduct.title);
  });

  it('original product should no longer be modified', async () => {
    testDraftProduct = await apos.product.find(apos.task.getReq({
      mode: 'draft'
    }), {
      _id: testDraftProduct._id
    }).toObject();
    assert(testDraftProduct);
    assert(!testDraftProduct.aposModified);
  });

  it('original product still shows as unmodified if we update it with no changes', async () => {
    testDraftProduct = await apos.product.update(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
    assert(!testDraftProduct.aposModified);
  });

  it('original product shows as modified if we make a change to it', async () => {
    testDraftProduct.title = 'Another Title';
    testDraftProduct = await apos.product.update(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
    assert(testDraftProduct.aposModified);
  });

  it('can revert the draft to published', async () => {
    testDraftProduct = await apos.product.revert(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
    assert(testDraftProduct);
    assert(!testDraftProduct.aposModified);
    assert(testDraftProduct.title === 'Test Product');
  });

  it('cannot revert the draft again', async () => {
    assert(!await apos.product.revert(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct));
  });

  it('original product shows as modified if we make another change to it', async () => {
    testDraftProduct.title = 'Title 3';
    testDraftProduct = await apos.product.update(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
    assert(testDraftProduct.aposModified);
  });

  it('should be able to publish the product', async () => {
    await apos.product.publish(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
  });

  it('original product shows as modified if we make a third change to it', async () => {
    testDraftProduct.title = 'Title 4';
    testDraftProduct = await apos.product.update(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
    assert(testDraftProduct.aposModified);
  });

  it('can revert the draft to Title 3', async () => {
    testDraftProduct = await apos.product.revert(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
    assert(testDraftProduct);
    assert(!testDraftProduct.aposModified);
    assert(testDraftProduct.title === 'Title 3');
  });

  it('can revert the draft to Test Product (previous publication)', async () => {
    testDraftProduct = await apos.product.revert(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
    assert(testDraftProduct);
    assert(testDraftProduct.title === 'Test Product');
    assert(!testDraftProduct.aposModified);
  });

  it('cannot revert the draft again', async () => {
    assert(!await apos.product.revert(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct));
  });

  let parent;

  it('should be able to create and insert a draft page', async () => {
    parent = {
      type: 'test-page',
      title: 'Parent',
      slug: '/test-page'
    };
    parent = await apos.page.insert(apos.task.getReq({
      mode: 'draft'
    }), '_home', 'lastChild', parent);
    assert(parent.aposModified);
  });

  it('published should not exist yet', async () => {
    assert(!await apos.doc.db.findOne({
      _id: parent._id.replace(':draft', ':published')
    }));
  });

  it('should be able to publish the page', async () => {
    await apos.page.publish(apos.task.getReq({
      mode: 'draft'
    }), parent);
  });

  it('published page should exist and be the same', async () => {
    const product = await apos.page.find(apos.task.getReq({
      mode: 'published'
    }), {
      _id: parent._id.replace(':draft', ':published')
    }).toObject();
    assert(product);
    assert(product.aposDocId === parent.aposDocId);
    assert(product.aposLocale === 'en:published');
    assert(product.title === parent.title);
  });

  it('original page should no longer be modified', async () => {
    parent = await apos.page.find(apos.task.getReq({
      mode: 'draft'
    }), {
      _id: parent._id
    }).toObject();
    assert(parent);
    assert(!parent.aposModified);
  });

  it('original page still shows as unmodified if we update it with no changes', async () => {
    parent = await apos.page.update(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(!parent.aposModified);
  });

  it('original page shows as modified if we make a change to it', async () => {
    parent.title = 'Another Title';
    parent = await apos.page.update(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent.aposModified);
  });

  it('can revert the page draft to published', async () => {
    parent = await apos.product.revert(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent);
    assert(!parent.aposModified);
    assert(parent.title === 'Test Product');
  });

  it('cannot revert the draft again', async () => {
    assert(!await apos.product.revert(apos.task.getReq({
      mode: 'draft'
    }), parent));
  });

  it('original product shows as modified if we make another change to it', async () => {
    parent.title = 'Title 3';
    parent = await apos.product.update(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent.aposModified);
  });

  it('should be able to publish the product', async () => {
    await apos.product.publish(apos.task.getReq({
      mode: 'draft'
    }), parent);
  });

  it('original product shows as modified if we make a third change to it', async () => {
    parent.title = 'Title 4';
    parent = await apos.product.update(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent.aposModified);
  });

  it('can revert the draft to Title 3', async () => {
    parent = await apos.product.revert(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent);
    assert(!parent.aposModified);
    assert(parent.title === 'Title 3');
  });

  it('can revert the draft to Test Product (previous publication)', async () => {
    parent = await apos.product.revert(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent);
    assert(parent.title === 'Test Product');
    assert(!parent.aposModified);
  });

  it('cannot revert the draft again', async () => {
    assert(!await apos.product.revert(apos.task.getReq({
      mode: 'draft'
    }), parent));
  });

});
