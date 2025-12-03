const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Draft / Published', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function () {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize with a schema', async function() {
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
                builders: {
                  project: {
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

  it('should be able to create and insert a draft product', async function() {
    const product = apos.product.newInstance();
    product.title = 'Test Product';
    testDraftProduct = await apos.product.insert(apos.task.getReq({
      mode: 'draft'
    }), product);
    assert(testDraftProduct.modified);
  });

  it('published should not exist yet', async function() {
    assert(!await apos.doc.db.findOne({
      _id: testDraftProduct._id.replace(':draft', ':published')
    }));
  });

  it('should be able to publish the product', async function() {
    await apos.product.publish(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
  });

  it('published product should exist and be the same', async function() {
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

  it('original product should no longer be modified', async function() {
    testDraftProduct = await apos.product.find(apos.task.getReq({
      mode: 'draft'
    }), {
      _id: testDraftProduct._id
    }).toObject();
    assert(testDraftProduct);
    assert(!testDraftProduct.modified);
  });

  it('original product still shows as unmodified if we update it with no changes', async function() {
    testDraftProduct = await apos.product.update(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
    assert(!testDraftProduct.modified);
  });

  it('original product shows as modified if we make a change to it', async function() {
    testDraftProduct.title = 'Another Title';
    testDraftProduct = await apos.product.update(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
    assert(testDraftProduct.modified);
  });

  it('can revert the draft to published', async function() {
    testDraftProduct = await apos.product.revertDraftToPublished(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
    assert(testDraftProduct);
    assert(!testDraftProduct.modified);
    assert(testDraftProduct.title === 'Test Product');
  });

  it('cannot revert the draft again', async function() {
    assert(!await apos.product.revertDraftToPublished(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct));
  });

  it('original product shows as modified if we make another change to it', async function() {
    testDraftProduct.title = 'Title 3';
    testDraftProduct = await apos.product.update(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
    assert(testDraftProduct.modified);
  });

  it('should be able to publish the product again', async function() {
    await apos.product.publish(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
  });

  it('"previous published" should be deduplicated at this point, and previous have the right props', async function() {
    const previous = await apos.doc.db.findOne({
      _id: testDraftProduct._id.replace(':draft', ':previous')
    });
    assert(previous);
    assert(previous.aposMode === 'previous');
    assert.strictEqual(previous.slug, `deduplicate-${previous.aposDocId}-test-product`);
  });

  it('original product shows as modified if we make a third change to it', async function() {
    testDraftProduct.title = 'Title 4';
    testDraftProduct = await apos.product.update(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
    assert(testDraftProduct.modified);
  });

  it('can revert the draft to Title 3', async function() {
    testDraftProduct = await apos.product.revertDraftToPublished(apos.task.getReq({
      mode: 'draft'
    }), testDraftProduct);
    assert(testDraftProduct);
    assert(!testDraftProduct.modified);
    assert(testDraftProduct.title === 'Title 3');
  });

  it('can revert the published version to Test Product (previous publication)', async function() {
    const req = apos.task.getReq({
      mode: 'published'
    });
    let published = await apos.product.findOneForEditing(req, {
      aposDocId: testDraftProduct.aposDocId
    });
    assert(published && published.aposLocale === 'en:published');
    published = await apos.product.revertPublishedToPrevious(req, published);
    assert(published);
    // Make sure the slug is no longer deduplicated
    assert(published.slug === 'test-product');
    assert(published.title === 'Test Product');
    testDraftProduct = await apos.product.findOneForEditing(req.clone({
      mode: 'draft'
    }), {
      _id: testDraftProduct._id
    });
    assert(testDraftProduct);
    assert(testDraftProduct.title === 'Title 3');
    assert(testDraftProduct.modified);
  });

  it('cannot revert published to previous again', async function() {
    const req = apos.task.getReq({
      mode: 'published'
    });
    const published = await apos.product.findOneForEditing(req, {
      aposDocId: testDraftProduct.aposDocId
    });
    try {
      await apos.product.revertPublishedToPrevious(apos.task.getReq({
        mode: 'draft'
      }), published);
      assert(false);
    } catch (e) {
      assert(e.name === 'invalid');
    }
  });

  let parent;

  it('should be able to create and insert a draft page', async function() {
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
    assert(parent.modified);
  });

  it('published should not exist yet again', async function() {
    assert(!await apos.doc.db.findOne({
      _id: parent._id.replace(':draft', ':published')
    }));
  });

  it('should be able to publish the page', async function() {
    await apos.page.publish(apos.task.getReq({
      mode: 'draft'
    }), parent);
  });

  it('published page should exist and be the same', async function() {
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

  it('original page should no longer be modified', async function() {
    parent = await apos.page.find(apos.task.getReq({
      mode: 'draft'
    }), {
      _id: parent._id
    }).toObject();
    assert(parent);
    assert(!parent.modified);
  });

  it('original page still shows as unmodified if we update it with no changes', async function() {
    parent = await apos.page.update(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(!parent.modified);
  });

  it('original page shows as modified if we make a change to it', async function() {
    parent.title = 'Parent Title 2';
    parent = await apos.page.update(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent.modified);
  });

  it('can revert the page draft to published', async function() {
    parent = await apos.page.revertDraftToPublished(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent);
    assert(!parent.modified);
    assert(parent.title === 'Parent');
  });

  it('cannot revert the draft again (2)', async function() {
    assert(!await apos.page.revertDraftToPublished(apos.task.getReq({
      mode: 'draft'
    }), parent));
  });

  // TODO convert more tests, add tests involving the page tree more,
  // write another test file with REST tests, implement the RESTfulness

  it('original page shows as modified if we make another change to it', async function() {
    parent.title = 'Parent Title 3';
    parent = await apos.page.update(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent.modified);
  });

  it('should be able to publish the page again', async function() {
    await apos.page.publish(apos.task.getReq({
      mode: 'draft'
    }), parent);
  });

  it('original page shows as modified if we make a third change to it', async function() {
    parent.title = 'Parent Title 4';
    parent = await apos.page.update(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent.modified);
  });

  it('can revert the draft to parent Title 3', async function() {
    parent = await apos.page.revertDraftToPublished(apos.task.getReq({
      mode: 'draft'
    }), parent);
    assert(parent);
    assert(!parent.modified);
    assert(parent.title === 'Parent Title 3');
  });

  it('can revert the published version to previous', async function() {
    const req = apos.task.getReq({
      mode: 'published'
    });
    let published = await apos.page.findOneForEditing(req, {
      aposDocId: parent.aposDocId
    });
    assert(published && published.aposLocale === 'en:published');
    published = await apos.page.revertPublishedToPrevious(apos.task.getReq({
      mode: 'draft'
    }), published);
    assert(published);
    assert(published.title === 'Parent');
    parent = await apos.page.findOneForEditing(req.clone({
      mode: 'draft'
    }), {
      _id: parent._id
    });
    assert(parent);
    assert(parent.title === 'Parent Title 3');
    assert(parent.modified);
  });

  it('cannot revert published to previous again (2)', async function() {
    const req = apos.task.getReq({
      mode: 'published'
    });
    const published = await apos.page.findOneForEditing(req, {
      aposDocId: parent.aposDocId
    });
    try {
      await apos.page.revertPublishedToPrevious(apos.task.getReq({
        mode: 'draft'
      }), published);
      assert(false);
    } catch (e) {
      assert(e.name === 'invalid');
    }
  });

  let sibling;

  it('should be able to create and insert a sibling draft page', async function() {
    sibling = {
      type: 'test-page',
      title: 'Sibling',
      slug: '/sibling'
    };
    sibling = await apos.page.insert(apos.task.getReq({
      mode: 'draft'
    }), '_home', 'lastChild', sibling);
    assert(sibling.modified);
  });

  it('should be able to publish the sibling page', async function() {
    await apos.page.publish(apos.task.getReq({
      mode: 'draft'
    }), sibling);
  });

  let grandchild;

  it('should be able to create and insert a grandchild page', async function() {
    grandchild = {
      type: 'test-page',
      title: 'Grandchild',
      // At insert time, a good slug is up to the caller
      slug: '/parent/grandchild'
    };
    grandchild = await apos.page.insert(apos.task.getReq({
      mode: 'draft'
    }), parent._id, 'lastChild', grandchild);
    assert(grandchild.modified);
    assert.strictEqual(grandchild.path, `${parent.path}/${grandchild.aposDocId}`);
    assert.strictEqual(grandchild.slug, '/parent/grandchild');
  });

  it('published grandchild should not exist yet', async function() {
    assert(!await apos.page.find(apos.task.getReq({
      mode: 'published'
    }), {
      aposDocId: grandchild.aposDocId
    }).toObject());
  });

  it('should be able to publish the grandchild page', async function() {
    await apos.page.publish(apos.task.getReq({
      mode: 'draft'
    }), grandchild);
    const published = await apos.page.find(apos.task.getReq({
      mode: 'published'
    }), {
      aposDocId: grandchild.aposDocId
    }).toObject();
    assert(published);
    assert.strictEqual(published.aposMode, 'published');
    assert.strictEqual(published.path, `${parent.path}/${grandchild.aposDocId}`);
    assert.strictEqual(published.slug, '/parent/grandchild');
  });

  it('should be able to move the grandchild page beneath the sibling page', async function() {
    grandchild = await apos.page.find(apos.task.getReq({
      mode: 'draft'
    }), {
      _id: grandchild._id
    }).toObject();
    // Should not be modified to start
    assert(!grandchild.modified);
    await apos.page.move(apos.task.getReq({
      mode: 'draft'
    }), grandchild._id, sibling._id, 'lastChild');
    sibling = await apos.page.find(apos.task.getReq({
      mode: 'draft'
    }), {
      _id: sibling._id
    }).children(true).toObject();
    assert(sibling?._children?.[0]?._id === grandchild._id);
    grandchild = await apos.page.find(apos.task.getReq({
      mode: 'draft'
    }), {
      _id: grandchild._id
    }).toObject();
    // Should be considered modified because we moved it
    assert(!grandchild.modified);
  });

  it('published grandchild page should now also be beneath the sibling page', async function() {
    sibling = await apos.page.find(apos.task.getReq({
      mode: 'published'
    }), {
      aposDocId: sibling.aposDocId
    }).children(true).toObject();
    assert(sibling?._children?.[0]?.aposDocId === grandchild.aposDocId);
  });

  it('should be able to publish the grandchild page again to re-execute the move in the published locale', async function() {
    await apos.page.publish(apos.task.getReq({
      mode: 'draft'
    }), grandchild);
  });

  it('published grandchild page should now be beneath sibling page', async function() {
    const siblingPublished = await apos.page.find(apos.task.getReq({
      mode: 'published'
    }), {
      aposDocId: sibling.aposDocId
    }).children(true).toObject();

    assert(siblingPublished && siblingPublished._children && siblingPublished._children[0] && siblingPublished._children[0]._id === grandchild._id.replace(':draft', ':published'));
  });

  describe('unpublish', function() {
    describe('page', function() {
      const baseItem = {
        aposDocId: 'some-page',
        type: 'test-page',
        slug: '/some-page',
        visibility: 'public',
        path: '/some-page',
        level: 1,
        rank: 0
      };
      const draftItem = {
        ...baseItem,
        _id: 'some-page:en:draft',
        aposLocale: 'en:draft',
        aposMode: 'draft'
      };
      const publishedItem = {
        ...baseItem,
        _id: 'some-page:en:published',
        aposLocale: 'en:published',
        aposMode: 'published'
      };
      const previousItem = {
        ...baseItem,
        _id: 'some-page:en:previous',
        aposLocale: 'en:previous',
        aposMode: 'previous'
      };

      let draft;
      let published;
      let previous;

      this.beforeEach(async function() {
        await apos.doc.db.insertMany([
          draftItem,
          publishedItem,
          previousItem
        ]);

        const res = await apos.doc.db.findOne({ _id: 'some-page:en:published' });

        const req = apos.task.getReq({ mode: 'published' });
        draft = await apos.page.unpublish(req, res);

        published = await apos.doc.db.findOne({ _id: 'some-page:en:published' });
        previous = await apos.doc.db.findOne({ _id: 'some-page:en:previous' });
      });

      this.afterEach(async function() {
        await apos.doc.db.deleteMany({
          aposDocId: 'some-page'
        });
      });

      it('should remove the published and previous versions of a page', function() {
        assert(published === null);
        assert(previous === null);
      });

      it('should update the draft version of a page', function() {
        assert(draft._id === draftItem._id);
        assert(draft.modified === true);
        assert(draft.lastPublishedAt === null);
      });
    });

    describe('parked page', function() {
      it('should not unpublish parked pages', async function() {
        const baseItem = {
          aposDocId: 'some-parked-page',
          type: 'test-page',
          slug: '/some-parked-page',
          visibility: 'public',
          path: '/some-parked-page',
          level: 1,
          rank: 0,
          parked: 1
        };
        const draftItem = {
          ...baseItem,
          _id: 'some-parked-page:en:draft',
          aposLocale: 'en:draft'
        };
        const publishedItem = {
          ...baseItem,
          _id: 'some-parked-page:en:published',
          aposLocale: 'en:published'
        };

        await apos.doc.db.insertMany([
          draftItem,
          publishedItem
        ]);

        const res = await apos.doc.db.findOne({ _id: 'some-parked-page:en:published' });

        const req = apos.task.getReq({ mode: 'published' });
        try {
          await apos.page.unpublish(req, res);
        } catch (error) {
          assert(error.message === 'apostrophe:pageIsParkedAndCannotBeUnpublished');
          return;
        }
        throw new Error('unpublish should have thrown');
      });
    });

    describe('piece', function() {
      const baseItem = {
        aposDocId: 'some-product',
        type: 'product',
        slug: '/some-product',
        visibility: 'public'
      };
      const draftItem = {
        ...baseItem,
        _id: 'some-product:en:draft',
        aposLocale: 'en:draft'
      };
      const publishedItem = {
        ...baseItem,
        _id: 'some-product:en:published',
        aposLocale: 'en:published'
      };
      const previousItem = {
        ...baseItem,
        _id: 'some-product:en:previous',
        aposLocale: 'en:previous'
      };

      let draft;
      let published;
      let previous;

      this.beforeEach(async function() {
        await apos.doc.db.insertMany([
          draftItem,
          publishedItem,
          previousItem
        ]);

        const res = await apos.doc.db.findOne({ _id: 'some-product:en:published' });

        const req = apos.task.getReq({ mode: 'published' });
        draft = await apos.product.unpublish(req, res);

        published = await apos.doc.db.findOne({ _id: 'some-product:en:published' });
        previous = await apos.doc.db.findOne({ _id: 'some-product:en:previous' });
      });

      this.afterEach(async function() {
        await apos.doc.db.deleteMany({
          aposDocId: 'some-product'
        });
      });

      it('should remove the published and previous versions of a piece', function() {
        assert(published === null);
        assert(previous === null);
      });

      it('should update the draft version of a piece', function() {
        assert(draft._id === draftItem._id);
        assert(draft.modified === true);
        assert(draft.lastPublishedAt === null);
      });
    });
  });
});
