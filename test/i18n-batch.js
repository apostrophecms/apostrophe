const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('i18n batch localization', function() {
  this.timeout(t.timeout);

  let apos;

  const mockImages = [
    {
      type: '@apostrophecms/image',
      title: 'Image 1',
      slug: 'image-1',
      visibility: 'public',
      attachment: {
        extension: 'jpg',
        width: 500,
        height: 400
      }
    },
    {
      type: '@apostrophecms/image',
      title: 'Image 2',
      slug: 'image-2',
      visibility: 'public',
      attachment: {
        extension: 'jpg',
        width: 500,
        height: 400
      }
    }
  ];

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              fr: {
                prefix: '/fr'
              },
              es: {
                prefix: '/es'
              }
            }
          }
        },
        'example-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/image': {}
                  }
                }
              }
            }
          }
        },
        'example-piece': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/image': {}
                  }
                }
              },
              _tags: {
                type: 'relationship',
                withType: 'example-tags'
              }
            }
          }
        },
        'example-tags': {
          extend: '@apostrophecms/piece-type'
        }
      }
    });
  });

  beforeEach(async function() {
    await apos.doc.db.deleteMany(
      {
        type:
        {
          $in: [
            '@apostrophecms/image',
            'example-page',
            'example-piece',
            'example-tags'
          ]

        }
      }
    );
  });

  after(async function() {
    this.timeout(t.timeout);
    await t.destroy(apos);
    apos = null;
  });

  it('should not allow anonymous batch localization', async function () {
    const [ all ] = await insertPages(apos, mockImages);
    const req = apos.task.getAnonReq({
      body: {
        _ids: all.map(page => page._id),
        relatedTypes: [ '@apostrophecms/image' ],
        toLocales: [ 'fr', 'es' ],
        update: false,
        relatedOnly: false
      },
      qs: {
        aposMode: 'draft'
      }
    });
    await assert.rejects(
      async () => apos.modules['@apostrophecms/i18n']
        .localizeBatch(req, apos.page),
      {
        name: 'forbidden'
      }
    );
  });

  it('should validate input when localizing a batch', async function () {
    // _ids is required
    {

      const req = apos.task.getReq({
        body: {
          relatedTypes: [ ],
          toLocales: [ ],
          update: false,
          relatedOnly: false
        },
        qs: {
          aposMode: 'draft'
        }
      });
      await assert.rejects(
        async () => apos.modules['@apostrophecms/i18n']
          .localizeBatch(req, apos.page),
        {
          name: 'invalid'
        }
      );
    }

    // toLocales is required
    {
      const req = apos.task.getReq({
        body: {
          _ids: [],
          relatedTypes: [ ]
        },
        qs: {
          aposMode: 'draft'
        }
      });
      await assert.rejects(
        async () => apos.modules['@apostrophecms/i18n']
          .localizeBatch(req, apos.page),
        {
          name: 'invalid'
        }
      );
    }

    // relatedTypes is optional
    {
      const req = apos.task.getReq({
        body: {
          _ids: [],
          toLocales: [ ]
        },
        qs: {
          aposMode: 'draft'
        }
      });
      const log = await apos.modules['@apostrophecms/i18n']
        .localizeBatch(req, apos.page);

      assert.deepEqual(log, []);
    }
  });

  it('should localize a batch of pages - no update, all', async function () {
    const [ all, images ] = await insertPages(apos, mockImages);

    const req = apos.task.getReq({
      body: {
        _ids: all.map(page => page._id),
        relatedTypes: [ '@apostrophecms/image' ],
        toLocales: [ 'fr', 'es' ],
        update: false,
        relatedOnly: false
      },
      qs: {
        aposMode: 'draft'
      }
    });
    const log = await apos.modules['@apostrophecms/i18n']
      .localizeBatch(req, apos.page);

    // (3 pages + 2 images) * 2 languages
    assert.equal(log.length, 10);

    const actualErrors = log.filter(entry => entry.error !== false).length;
    assert.equal(actualErrors, 0);

    // Pages
    const [ home, page1, page2 ] = all;
    const homeFr = log.find(entry => entry._id === home._id && entry.locale === 'fr');
    const page1Fr = log.find(entry => entry._id === page1._id && entry.locale === 'fr');
    const page2Fr = log.find(entry => entry._id === page2._id && entry.locale === 'fr');

    assert.equal(homeFr.error, false);
    assert.equal(homeFr.relationship, false);
    assert.equal(page1Fr.error, false);
    assert.equal(page1Fr.relationship, false);
    assert.equal(page2Fr.error, false);
    assert.equal(page2Fr.relationship, false);

    const homeEs = log.find(entry => entry._id === home._id && entry.locale === 'es');
    const page1Es = log.find(entry => entry._id === page1._id && entry.locale === 'es');
    const page2Es = log.find(entry => entry._id === page2._id && entry.locale === 'es');

    assert.equal(homeEs.error, false);
    assert.equal(homeEs.relationship, false);
    assert.equal(page1Es.error, false);
    assert.equal(page1Es.relationship, false);
    assert.equal(page2Es.error, false);
    assert.equal(page2Es.relationship, false);

    // Relationships, no duplicates
    const [ image1, image2 ] = images;
    const image1Fr = log.find(entry => entry._id === image1._id && entry.locale === 'fr');
    const image2Fr = log.find(entry => entry._id === image2._id && entry.locale === 'fr');

    // Image 1 is related to both pages, but logs contain only the first
    // relationship that is found. Image 2 is related to page 2 only.
    assert.equal(image1Fr.error, false);
    assert.equal(image1Fr.relationship, page1Es.aposDocId);
    assert.equal(image2Fr.error, false);
    assert.equal(image2Fr.relationship, page2Es.aposDocId);

    const image1Es = log.find(entry => entry._id === image1._id && entry.locale === 'es');
    const image2Es = log.find(entry => entry._id === image2._id && entry.locale === 'es');

    assert.equal(image1Es.error, false);
    assert.equal(image1Es.relationship, page1Es.aposDocId);
    assert.equal(image2Es.error, false);
    assert.equal(image2Es.relationship, page2Es.aposDocId);

    // Attempt a second time (update option is false)
    {
      const log = await apos.modules['@apostrophecms/i18n']
        .localizeBatch(req, apos.page);

      const actualErrors = log.filter(entry => entry.error !== false).length;

      assert.equal(log.length, 10);
      assert.equal(actualErrors, 4);

      const homeFr = log.find(entry => entry._id === home._id && entry.locale === 'fr');
      const page1Fr = log.find(entry => entry._id === page1._id && entry.locale === 'fr');
      const page2Fr = log.find(entry => entry._id === page2._id && entry.locale === 'fr');
      const image1Fr = log.find(entry => entry._id === image1._id && entry.locale === 'fr');
      const image2Fr = log.find(entry => entry._id === image2._id && entry.locale === 'fr');
      const homeEs = log.find(entry => entry._id === home._id && entry.locale === 'es');
      const page1Es = log.find(entry => entry._id === page1._id && entry.locale === 'es');
      const page2Es = log.find(entry => entry._id === page2._id && entry.locale === 'es');
      const image1Es = log.find(entry => entry._id === image1._id && entry.locale === 'es');
      const image2Es = log.find(entry => entry._id === image2._id && entry.locale === 'es');

      assert.equal(homeFr.error, false);
      assert.equal(page1Fr.error, false);
      assert.equal(page2Fr.error, false);
      assert.equal(image1Fr.error, 'conflict');
      assert.equal(image2Fr.error, 'conflict');

      assert.equal(homeEs.error, false);
      assert.equal(page1Es.error, false);
      assert.equal(page2Es.error, false);
      assert.equal(image1Es.error, 'conflict');
      assert.equal(image2Es.error, 'conflict');
    }
  });

  it('should localize a path of pages - update, all', async function () {
    const [ all ] = await insertPages(apos, mockImages);

    const req = apos.task.getReq({
      body: {
        _ids: all.map(page => page._id),
        relatedTypes: [ '@apostrophecms/image' ],
        toLocales: [ 'fr', 'es' ],
        update: true,
        relatedOnly: false
      },
      qs: {
        aposMode: 'draft'
      }
    });

    // First pass
    await apos.modules['@apostrophecms/i18n']
      .localizeBatch(req, apos.page);
    // Second pass
    const log = await apos.modules['@apostrophecms/i18n']
      .localizeBatch(req, apos.page);

    assert.equal(log.length, 10);

    const actualErrors = log.filter(entry => entry.error !== false).length;
    assert.equal(actualErrors, 0);
  });

  it('should localize a batch of pages - no update, related only', async function () {
    const [ all, images ] = await insertPages(apos, mockImages);

    const req = apos.task.getReq({
      body: {
        _ids: all.map(page => page._id),
        relatedTypes: [ '@apostrophecms/image' ],
        toLocales: [ 'fr', 'es' ],
        update: false,
        relatedOnly: true
      },
      qs: {
        aposMode: 'draft'
      }
    });
    const log = await apos.modules['@apostrophecms/i18n']
      .localizeBatch(req, apos.page);

    // (2 images) * 2 languages
    assert.equal(log.length, 4);

    // Relationships, no duplicates
    const [ , page1, page2 ] = all;
    const [ image1, image2 ] = images;
    const image1Fr = log.find(entry => entry._id === image1._id && entry.locale === 'fr');
    const image2Fr = log.find(entry => entry._id === image2._id && entry.locale === 'fr');

    // Image 1 is related to both pages, but logs contain only the first
    // relationship that is found. Image 2 is related to page 2 only.
    assert.equal(image1Fr.error, false);
    assert.equal(image1Fr.relationship, page1.aposDocId);
    assert.equal(image2Fr.error, false);
    assert.equal(image2Fr.relationship, page2.aposDocId);

    const image1Es = log.find(entry => entry._id === image1._id && entry.locale === 'es');
    const image2Es = log.find(entry => entry._id === image2._id && entry.locale === 'es');

    assert.equal(image1Es.error, false);
    assert.equal(image1Es.relationship, page1.aposDocId);
    assert.equal(image2Es.error, false);
    assert.equal(image2Es.relationship, page2.aposDocId);
  });

  it('should localize a batch of pieces', async function () {
    const [ all ] = await insertPieces(apos, mockImages);

    const req = apos.task.getReq({
      body: {
        _ids: all.map(piece => piece._id),
        relatedTypes: [ '@apostrophecms/image', 'example-tags' ],
        toLocales: [ 'fr', 'es' ],
        update: false,
        relatedOnly: false
      },
      qs: {
        aposMode: 'draft'
      }
    });
    const log = await apos.modules['@apostrophecms/i18n']
      .localizeBatch(req, apos.modules['example-piece']);

    // (2 pieces + 2 images + 2 tags) * 2 languages
    assert.equal(log.length, 12);

    const actualErrors = log.filter(entry => entry.error !== false).length;
    assert.equal(actualErrors, 0);

    // 2 tags * 2 languages
    const actualTags = log.filter(entry => entry.type === 'example-tags').length;
    assert.equal(actualTags, 4);

    // 2 images * 2 languages
    const actualImages = log.filter(entry => entry.type === '@apostrophecms/image').length;
    assert.equal(actualImages, 4);
  });
});

async function insertPages(apos, mockImages) {
  const req = apos.task.getReq({
    mode: 'draft',
    qs: {
      aposMode: 'draft'
    }
  });
  const home = await apos.page.find(req, {
    parkedId: 'home'
  }).toObject();
  const manager = apos.doc.getManager('example-page');

  const image1 = await apos.image.insert(req, {
    ...mockImages[0]
  });
  const input1 = {
    type: 'example-page',
    title: 'Page 1',
    main: {
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/image',
          _image: [
            { ...image1 }
          ]
        }
      ]
    }
  };
  let page1 = manager.newInstance();
  await manager.convert(req, input1, page1);
  page1 = await apos.page.insert(req, home._id, 'lastChild', {
    ...page1,
    type: 'example-page'
  });

  const image2 = await apos.image.insert(req, {
    ...mockImages[1]
  });
  const input2 = {
    type: 'example-page',
    title: 'Page 2',
    main: {
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/image',
          _image: [
            { ...image1 }
          ]
        },
        {
          metaType: 'widget',
          type: '@apostrophecms/image',
          _image: [
            { ...image2 }
          ]
        }
      ]
    }
  };
  const page2 = manager.newInstance();
  await manager.convert(req, input2, page2);
  await apos.page.insert(req, page1._id, 'lastChild', {
    ...page2,
    type: 'example-page'
  });

  const all = await apos.page.find(req.clone({ mode: 'draft' }))
    .sort({ level: 'asc' }).toArray();
  assert(all.length === 3);
  assert(all[1].title === 'Page 1');
  assert(all[1].level === 1);
  assert(all[2].title === 'Page 2');
  assert(all[2].level === 2);

  return [ all, [ image1, image2 ] ];
}

async function insertPieces(apos, mockImages) {
  const req = apos.task.getReq({
    mode: 'draft',
    qs: {
      aposMode: 'draft'
    }
  });
  const tag1 = await apos.doc.getManager('example-tags').insert(req, {
    title: 'Tag 1'
  });
  const tag2 = await apos.doc.getManager('example-tags').insert(req, {
    title: 'Tag 2'
  });

  const manager = apos.doc.getManager('example-piece');

  const image1 = await apos.image.insert(req, {
    ...mockImages[0]
  });
  const input1 = {
    type: 'example-piece',
    title: 'Piece 1',
    main: {
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/image',
          _image: [
            { ...image1 }
          ]
        }
      ]
    },
    _tags: [ tag1 ]
  };
  const piece1 = manager.newInstance();
  await manager.convert(req, input1, piece1);
  await manager.insert(req, piece1);

  const image2 = await apos.image.insert(req, {
    ...mockImages[1]
  });
  const input2 = {
    type: 'example-piece',
    title: 'Piece 2',
    main: {
      items: [
        {
          metaType: 'widget',
          type: '@apostrophecms/image',
          _image: [
            { ...image1 }
          ]
        },
        {
          metaType: 'widget',
          type: '@apostrophecms/image',
          _image: [
            { ...image2 }
          ]
        }
      ]
    },
    _tags: [ tag1, tag2 ]
  };
  const piece2 = manager.newInstance();
  await manager.convert(req, input2, piece2);
  await manager.insert(req, piece2);

  const all = await manager.find(req).sort({ createdAt: 'asc' }).toArray();

  assert(all.length === 2);
  assert(all[0].title === 'Piece 1');
  assert(all[1].title === 'Piece 2');

  return [ all, [ image1, image2 ], [ tag1, tag2 ] ];

}
