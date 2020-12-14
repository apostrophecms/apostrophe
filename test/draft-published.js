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
      slug: '/parent'
    };
    const req = apos.task.getReq({
      mode: 'draft'
    });
    parent = await apos.page.insert(req, '_home', 'lastChild', parent);
    const home = await apos.page.find(req, {
      slug: '/',
      level: 0
    }).toObject();
    assert.strictEqual(parent.path, `${home.path}/${parent.aposDocId}`);
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
    const publishedParent = await apos.page.find(apos.task.getReq({
      mode: 'published'
    }), {
      _id: parent._id.replace(':draft', ':published')
    }).toObject();
    assert(publishedParent);
    assert(publishedParent.aposDocId === parent.aposDocId);
    assert(publishedParent.aposLocale === 'en:published');
    assert(publishedParent.title === parent.title);
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
    parent.title = 'Parent Title 2';
    parent = await apos.page.update(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent.aposModified);
  });

  it('can revert the page draft to published', async () => {
    parent = await apos.page.revert(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent);
    assert(!parent.aposModified);
    assert(parent.title === 'Parent');
  });

  it('cannot revert the draft again', async () => {
    assert(!await apos.page.revert(apos.task.getReq({
      mode: 'draft'
    }), parent));
  });

  // TODO convert more tests, add tests involving the page tree more,
  // write another test file with REST tests, implement the RESTfulness

  it('original page shows as modified if we make another change to it', async () => {
    parent.title = 'Parent Title 3';
    parent = await apos.page.update(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent.aposModified);
  });

  it('should be able to publish the page', async () => {
    await apos.page.publish(apos.task.getReq({
      mode: 'draft'
    }), parent);
  });

  it('original page shows as modified if we make a third change to it', async () => {
    parent.title = 'Parent Title 4';
    parent = await apos.page.update(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent.aposModified);
  });

  it('can revert the draft to parent Title 3', async () => {
    parent = await apos.page.revert(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent);
    assert(!parent.aposModified);
    assert(parent.title === 'Parent Title 3');
  });

  it('can revert the draft to Parent (previous publication)', async () => {
    parent = await apos.page.revert(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent);
    // Parent Title 2 was never published so we're all the
    // way back to Parent, the first published value
    assert(parent.title === 'Parent');
    assert(!parent.aposModified);
  });

  it('cannot revert the draft again', async () => {
    assert(!await apos.page.revert(apos.task.getReq({
      mode: 'draft'
    }), parent));
  });

  let sibling;

  it('should be able to create and insert a sibling draft page', async () => {
    sibling = {
      type: 'test-page',
      title: 'Sibling',
      slug: '/sibling'
    };
    sibling = await apos.page.insert(apos.task.getReq({
      mode: 'draft'
    }), '_home', 'lastChild', sibling);
    assert(sibling.aposModified);
  });

  it('should be able to publish the sibling page', async () => {
    await apos.page.publish(apos.task.getReq({
      mode: 'draft'
    }), sibling);
  });

  let grandchild;

  it('should be able to create and insert a grandchild page', async () => {
    grandchild = {
      type: 'test-page',
      title: 'Grandchild',
      // At insert time, a good slug is up to the caller
      slug: '/parent/grandchild'
    };
    grandchild = await apos.page.insert(apos.task.getReq({
      mode: 'draft'
    }), parent._id, 'lastChild', grandchild);
    assert(grandchild.aposModified);
    assert.strictEqual(grandchild.path, `${parent.path}/${grandchild.aposDocId}`);
  });

  it('published grandchild should not exist yet', async () => {
    assert(!await apos.page.find(apos.task.getReq({
      mode: 'published'
    }), {
      aposDocId: grandchild.aposDocId
    }).toObject());
  });

  it('should be able to publish the grandchild page', async () => {
    await apos.page.publish(apos.task.getReq({
      mode: 'draft'
    }), grandchild);
  });

  it('should be able to move the grandchild page beneath the sibling page', async () => {
    await apos.page.move(apos.task.getReq({
      mode: 'draft'
    }), grandchild._id, sibling._id, 'lastChild');
    sibling = await apos.page.find(apos.task.getReq({
      mode: 'draft'
    }), {
      _id: sibling._id
    }).children(true).toObject();
    console.log(sibling);
    assert(sibling && sibling._children && sibling._children[0] && sibling._children[0]._id === grandchild._id);
    grandchild = await apos.page.find(apos.task.getReq({
      mode: 'draft'
    }), {
      _id: grandchild._id
    }).toObject();
    // Should be considered modified because we moved it
    assert(grandchild.aposModified);
  });

  it('published grandchild page should still be beneath parent page', async () => {
    parent = await apos.page.find(apos.task.getReq({
      mode: 'published'
    }), {
      aposDocId: parent.aposDocId
    }).children(true).toObject();
    assert(parent._children[0]._id === grandchild._id.replace(':draft', ':published'));
  });

  it('should be able to publish the grandchild page again to re-execute the move in the published locale', async () => {
    await apos.page.publish(apos.task.getReq({
      mode: 'draft'
    }), grandchild);
  });

  it('published grandchild page should now be beneath sibling page', async () => {
    sibling = await apos.page.find(apos.task.getReq({
      mode: 'published'
    }), {
      aposDocId: sibling.aposDocId
    }).children(true).toObject();
    assert(sibling && sibling._children && sibling._children[0] && sibling._children[0]._id === grandchild._id.replace(':draft', ':published'));
  });

  it('can revert the grandchild page to previous publication, undoing the move', async () => {
    const req = apos.task.getReq({
      mode: 'draft'
    });
    grandchild = await apos.page.find(req, {
      _id: grandchild._id
    }).toObject();
    grandchild = await apos.page.revert(req, grandchild);
    parent = apos.page.find(apos.task.getReq({
      mode: 'draft'
    }), {
      _id: parent._id
    }).toObject();
    assert(parent && parent._children && parent._children[0] && parent._children[0]._id === grandchild._id);
  });

});
