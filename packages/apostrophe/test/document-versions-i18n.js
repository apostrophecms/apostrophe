const assert = require('node:assert').strict;
const {
  t,
  bootstrap: bootstrapWith,
  removeUploads,
  cleanup,
  getReq,
  destroy
} = require('./utils/document-versions.js');

const bootstrap = (config) => bootstrapWith({
  root: module,
  ...config
});

describe('Document Versions: i18n', function () {
  this.timeout(t.timeout);

  let apos;

  after(function() {
    return destroy(apos);
  });

  beforeEach(async function() {
    await removeUploads();
    await destroy(apos);

    apos = await bootstrap({
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              'en-US': {
                prefix: '/en-US'
              },
              fr: {
                prefix: '/fr'
              }
            }
          }
        },
        article: {},
        'article-page': {},
        'default-page': {}
      }
    });

  });

  afterEach(async function() {
    await cleanup(apos);
  });

  async function setup() {
    const req = getReq(apos, {
      _id: 1,
      username: 'user'
    });

    // piece
    const article1 = await apos.article.insert(req, {
      title: 'Article 1'
    });
    const article2 = await apos.article.insert(req, {
      title: 'Article 2'
    });
    await apos.article.update(req, {
      ...article1,
      title: 'Article 1 v2'
    });
    await apos.article.update(req, {
      ...article2,
      title: 'Article 2 v2'
    });

    // piece-page
    const articlePage1 = await apos.page.insert(
      req,
      '_home',
      'lastChild',
      {
        title: 'Article page 1',
        type: 'article-page'
      }
    );
    const articlePage2 = await apos.page.insert(
      req,
      '_home',
      'lastChild',
      {
        title: 'Article page 2',
        type: 'article-page'
      }
    );
    await apos.page.update(req, {
      ...articlePage1,
      title: 'Article page 1 v2'
    });
    await apos.page.update(req, {
      ...articlePage2,
      title: 'Article page 2 v2'
    });

    // default-page
    const defaultPage1 = await apos.page.insert(
      req,
      '_home',
      'lastChild',
      {
        title: 'Default page 1',
        type: 'default-page'
      }
    );
    const defaultPage2 = await apos.page.insert(
      req,
      '_home',
      'lastChild',
      {
        title: 'Default page 2',
        type: 'default-page'
      }
    );
    await apos.page.update(req, {
      ...defaultPage1,
      title: 'Default page 1 v2'
    });
    await apos.page.update(req, {
      ...defaultPage2,
      title: 'Default page 2 v2'
    });

    // image: autopublish + attachment
    const image1 = await apos.image.insert(req, {
      title: 'Image 1',
      slug: 'image-1',
      visibility: 'public',
      attachment: {
        extension: 'jpg',
        width: 500,
        height: 400
      }
    });
    const image2 = await apos.image.insert(req, {
      title: 'Image 2',
      slug: 'image-2',
      visibility: 'public',
      attachment: {
        extension: 'jpg',
        width: 500,
        height: 400
      }
    });
    await apos.image.update(req, {
      ...image1,
      title: 'Image 1 v2'
    });
    await apos.image.update(req, {
      ...image2,
      title: 'Image 2 v2'
    });

    return {
      article1,
      article2,
      articlePage1,
      articlePage2,
      defaultPage1,
      defaultPage2,
      image1,
      image2
    };
  };

  it('should rename locale in aposDocs and aposDocsVersions', async function () {
    await setup();

    // change doc IDs
    const oldLocale = 'en';
    const newLocale = 'en-US';
    const actual = await apos.i18n.rename(oldLocale, newLocale, { keep: newLocale });
    const expected = {
      // 18 docs (archive, global, styles, home + the inserted docs) and the
      // 18 versions of the inserted docs
      renamed: 36,
      // 9 docs (global, styles, home) and the 4 boot-time versions of global,
      // styles and home in `en`, dropped because `en-US` already has theirs
      kept: 13
    };
    assert.deepEqual(actual, expected);
  });

  it('should rename locale in aposDocsVersions', async function () {
    const {
      article1,
      article2,
      articlePage1,
      articlePage2,
      defaultPage1,
      defaultPage2,
      image1,
      image2
    } = await setup();

    // change doc IDs
    const oldLocale = 'en';
    const newLocale = 'en-US';
    const actual = await apos.docVersions.renameLocale(oldLocale, newLocale, {});
    const expected = {
      // 18 versions of the inserted docs + 4 boot-time versions of global,
      // styles and home; without `keep` the two locales' histories merge
      renamed: 22,
      kept: 0
    };
    assert.deepEqual(actual, expected);

    const req = getReq(apos, {
      _id: 1,
      username: 'user',
      aposLocale: 'en-US:published'
    });

    // check articles
    {
      const versions = await apos.docVersions
        .find(
          req,
          {
            docId: {
              $in: [
                article1.aposDocId,
                article2.aposDocId
              ]
            },
            locale: newLocale
          }
        );

      const actual = versions.map(version => ({
        docId: version.docId,
        doc: {
          _id: version.doc._id,
          title: version.doc.title,
          aposDocId: version.doc.aposDocId,
          aposLocale: version.doc.aposLocale,
          path: version.doc.path
        }
      }));
      const expected = [
        {
          docId: article2.aposDocId,
          doc: {
            _id: article2._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: article2.title.concat(' v2'),
            aposDocId: article2.aposDocId,
            aposLocale: article2.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: article2.path
          }
        },
        {
          docId: article1.aposDocId,
          doc: {
            _id: article1._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: article1.title.concat(' v2'),
            aposDocId: article1.aposDocId,
            aposLocale: article1.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: article1.path
          }
        },
        {
          docId: article2.aposDocId,
          doc: {
            _id: article2._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: article2.title,
            aposDocId: article2.aposDocId,
            aposLocale: article2.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: article2.path
          }
        },
        {
          docId: article1.aposDocId,
          doc: {
            _id: article1._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: article1.title,
            aposDocId: article1.aposDocId,
            aposLocale: article1.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: article1.path
          }
        }
      ];

      assert.deepEqual(actual, expected);
    }

    // check article-pages
    {
      const versions = await apos.docVersions
        .find(
          req,
          {
            docId: {
              $in: [
                articlePage1.aposDocId,
                articlePage2.aposDocId
              ]
            },
            locale: newLocale
          }
        );

      const actual = versions.map(version => ({
        docId: version.docId,
        doc: {
          _id: version.doc._id,
          title: version.doc.title,
          aposDocId: version.doc.aposDocId,
          aposLocale: version.doc.aposLocale,
          path: version.doc.path
        }
      }));
      const expected = [
        {
          docId: articlePage2.aposDocId,
          doc: {
            _id: articlePage2._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: articlePage2.title.concat(' v2'),
            aposDocId: articlePage2.aposDocId,
            aposLocale: articlePage2.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: articlePage2.path
          }
        },
        {
          docId: articlePage1.aposDocId,
          doc: {
            _id: articlePage1._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: articlePage1.title.concat(' v2'),
            aposDocId: articlePage1.aposDocId,
            aposLocale: articlePage1.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: articlePage1.path
          }
        },
        {
          docId: articlePage2.aposDocId,
          doc: {
            _id: articlePage2._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: articlePage2.title,
            aposDocId: articlePage2.aposDocId,
            aposLocale: articlePage2.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: articlePage2.path
          }
        },
        {
          docId: articlePage1.aposDocId,
          doc: {
            _id: articlePage1._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: articlePage1.title,
            aposDocId: articlePage1.aposDocId,
            aposLocale: articlePage1.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: articlePage1.path
          }
        }
      ];

      assert.deepEqual(actual, expected);
    }

    // check default-pages
    {
      const versions = await apos.docVersions
        .find(
          req,
          {
            docId: {
              $in: [
                defaultPage1.aposDocId,
                defaultPage2.aposDocId
              ]
            },
            locale: newLocale
          }
        );

      const actual = versions.map(version => ({
        docId: version.docId,
        doc: {
          _id: version.doc._id,
          title: version.doc.title,
          aposDocId: version.doc.aposDocId,
          aposLocale: version.doc.aposLocale,
          path: version.doc.path
        }
      }));
      const expected = [
        {
          docId: defaultPage2.aposDocId,
          doc: {
            _id: defaultPage2._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: defaultPage2.title.concat(' v2'),
            aposDocId: defaultPage2.aposDocId,
            aposLocale: defaultPage2.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: defaultPage2.path
          }
        },
        {
          docId: defaultPage1.aposDocId,
          doc: {
            _id: defaultPage1._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: defaultPage1.title.concat(' v2'),
            aposDocId: defaultPage1.aposDocId,
            aposLocale: defaultPage1.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: defaultPage1.path
          }
        },
        {
          docId: defaultPage2.aposDocId,
          doc: {
            _id: defaultPage2._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: defaultPage2.title,
            aposDocId: defaultPage2.aposDocId,
            aposLocale: defaultPage2.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: defaultPage2.path
          }
        },
        {
          docId: defaultPage1.aposDocId,
          doc: {
            _id: defaultPage1._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: defaultPage1.title,
            aposDocId: defaultPage1.aposDocId,
            aposLocale: defaultPage1.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: defaultPage1.path
          }
        }
      ];

      assert.deepEqual(actual, expected);
    }

    // check images
    {
      const versions = await apos.docVersions
        .find(
          req,
          {
            docId: {
              $in: [
                image1.aposDocId,
                image2.aposDocId
              ]
            },
            locale: newLocale
          }
        );

      const actual = versions.map(version => ({
        docId: version.docId,
        doc: {
          _id: version.doc._id,
          title: version.doc.title,
          aposDocId: version.doc.aposDocId,
          aposLocale: version.doc.aposLocale,
          path: version.doc.path,
          attachmentDocIds: version.doc.attachment?.docIds || []
        }
      }));
      const expected = [
        {
          docId: image2.aposDocId,
          doc: {
            _id: image2._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: image2.title.concat(' v2'),
            aposDocId: image2.aposDocId,
            aposLocale: image2.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: image2.path,
            attachmentDocIds: image2.attachment.docIds
              ?.map(docId => docId.replace(`:${oldLocale}:`, `:${newLocale}:`)) || []
          }
        },
        {
          docId: image1.aposDocId,
          doc: {
            _id: image1._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: image1.title.concat(' v2'),
            aposDocId: image1.aposDocId,
            aposLocale: image1.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: image1.path,
            attachmentDocIds: image2.attachment.docIds
              ?.map(docId => docId.replace(`:${oldLocale}:`, `:${newLocale}:`)) || []
          }
        },
        {
          docId: image2.aposDocId,
          doc: {
            _id: image2._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: image2.title,
            aposDocId: image2.aposDocId,
            aposLocale: image2.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: image2.path,
            attachmentDocIds: image2.attachment.docIds
              ?.map(docId => docId.replace(`:${oldLocale}:`, `:${newLocale}:`)) || []
          }
        },
        {
          docId: image2.aposDocId,
          doc: {
            _id: image2._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: image2.title,
            aposDocId: image2.aposDocId,
            aposLocale: image2.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: image2.path,
            attachmentDocIds: image2.attachment.docIds
              ?.map(docId => docId.replace(`:${oldLocale}:`, `:${newLocale}:`)) || []
          }
        },
        {
          docId: image1.aposDocId,
          doc: {
            _id: image1._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: image1.title,
            aposDocId: image1.aposDocId,
            aposLocale: image1.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: image1.path,
            attachmentDocIds: image2.attachment.docIds
              ?.map(docId => docId.replace(`:${oldLocale}:`, `:${newLocale}:`)) || []
          }
        },
        {
          docId: image1.aposDocId,
          doc: {
            _id: image1._id.replace(`:${oldLocale}:`, `:${newLocale}:`),
            title: image1.title,
            aposDocId: image1.aposDocId,
            aposLocale: image1.aposLocale.replace(`${oldLocale}:`, `${newLocale}:`),
            path: image1.path,
            attachmentDocIds: image2.attachment.docIds
              ?.map(docId => docId.replace(`:${oldLocale}:`, `:${newLocale}:`)) || []
          }
        }
      ];

      assert.deepEqual(actual, expected);
    }
  });
});
