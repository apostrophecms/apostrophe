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
      // 26 versions of the inserted docs
      renamed: 44,
      // 9 docs (global, styles, home) and the 7 boot-time versions of global,
      // styles and home in `en`, dropped because `en-US` already has theirs
      kept: 16
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
      // 26 versions of the inserted docs + 7 boot-time versions of global,
      // styles and home; without `keep` the two locales' histories merge
      renamed: 33,
      kept: 0
    };
    assert.deepEqual(actual, expected);

    const req = getReq(apos, {
      _id: 1,
      username: 'user',
      aposLocale: 'en-US:published'
    });

    // What the rename leaves of a version of `doc` saved in `mode`
    function renamedVersion(doc, { title = doc.title, mode = 'published' } = {}) {
      return {
        docId: doc.aposDocId,
        doc: {
          _id: `${doc.aposDocId}:${newLocale}:${mode}`,
          title,
          aposDocId: doc.aposDocId,
          aposLocale: `${newLocale}:${mode}`,
          path: doc.path,
          attachmentDocIds: (doc.attachment?.docIds || [])
            .map(docId => docId.replace(`:${oldLocale}:`, `:${newLocale}:`))
        }
      };
    }

    async function renamedVersionsOf(docs) {
      const versions = await apos.docVersions.find(req, {
        docId: { $in: docs.map(doc => doc.aposDocId) },
        locale: newLocale
      });
      return versions.map(version => ({
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
    }

    // Two documents inserted in published mode then updated, newest first:
    // each insert records the draft and the published copy
    function timelineOf(doc1, doc2) {
      return [
        renamedVersion(doc2, { title: doc2.title.concat(' v2') }),
        renamedVersion(doc1, { title: doc1.title.concat(' v2') }),
        renamedVersion(doc2),
        renamedVersion(doc2, { mode: 'draft' }),
        renamedVersion(doc1),
        renamedVersion(doc1, { mode: 'draft' })
      ];
    }

    assert.deepEqual(
      await renamedVersionsOf([ article1, article2 ]),
      timelineOf(article1, article2)
    );
    assert.deepEqual(
      await renamedVersionsOf([ articlePage1, articlePage2 ]),
      timelineOf(articlePage1, articlePage2)
    );
    assert.deepEqual(
      await renamedVersionsOf([ defaultPage1, defaultPage2 ]),
      timelineOf(defaultPage1, defaultPage2)
    );

    // Images autopublish, so an insert publishes twice
    assert.deepEqual(
      await renamedVersionsOf([ image1, image2 ]),
      [
        renamedVersion(image2, { title: image2.title.concat(' v2') }),
        renamedVersion(image1, { title: image1.title.concat(' v2') }),
        renamedVersion(image2),
        renamedVersion(image2),
        renamedVersion(image2, { mode: 'draft' }),
        renamedVersion(image1),
        renamedVersion(image1),
        renamedVersion(image1, { mode: 'draft' })
      ]
    );
  });

  describe('locale isolation', function () {
    const req = () => getReq(apos, {
      _id: 'user',
      title: 'User'
    });
    const draftReq = (locale = 'en') => getReq(apos, {
      _id: 'user',
      title: 'User',
      mode: 'draft',
      locale
    });
    const findDraft = (locale, doc) => apos.article
      .find(draftReq(locale), { aposDocId: doc.aposDocId })
      .toObject();
    // Records as stored, so a replace in place shows as well
    const recordsIn = (locale, doc) => apos.docVersions.find(
      req(),
      {
        docId: doc.aposDocId,
        locale
      },
      { raw: true }
    );

    it('should keep draft saves in the locale they are made in', async function () {
      const article = await apos.article.insert(req(), { title: 'Article' });
      await apos.article.localize(draftReq(), await findDraft('en', article), 'fr');
      const fr = await recordsIn('fr', article);
      const en = await recordsIn('en', article);

      await apos.article.update(draftReq(), {
        ...await findDraft('en', article),
        title: 'Article v2'
      });
      await apos.article.update(draftReq(), {
        ...await findDraft('en', article),
        title: 'Article v3'
      });

      assert.deepEqual(await recordsIn('fr', article), fr);
      const [ newest, ...rest ] = await recordsIn('en', article);
      assert.deepEqual(rest, en);
      assert.equal(newest.mode, 'draft');
      assert.equal((await apos.docVersions.unpack(newest.doc)).title, 'Article v3');
    });

    it('should record a localization in the target locale only', async function () {
      const article = await apos.article.insert(req(), { title: 'Article' });
      const en = await recordsIn('en', article);

      await apos.article.localize(draftReq(), await findDraft('en', article), 'fr');

      assert.deepEqual(await recordsIn('en', article), en);
      const fr = await apos.docVersions.find(req(), {
        docId: article.aposDocId,
        locale: 'fr'
      });
      assert.deepEqual(
        fr.map(version => [ version.mode, version.doc.aposLocale, version.doc.title ]),
        [ [ 'draft', 'fr:draft', 'Article' ] ]
      );
      assert.equal(
        await apos.docVersions.db.countDocuments({
          docId: article.aposDocId,
          locale: { $nin: [ 'en', 'fr' ] }
        }),
        0
      );
    });
  });

  describe('AI localization', function () {
    const editor = () => getReq(apos, {
      _id: 'alice-id',
      title: 'Alice',
      mode: 'draft'
    });
    const findDraft = (locale, doc) => apos.article
      .find(getReq(apos, {
        mode: 'draft',
        locale
      }), { aposDocId: doc.aposDocId })
      .toObject();
    const versionsIn = (locale, doc) => apos.docVersions.find(editor(), {
      docId: doc.aposDocId,
      locale
    });
    const summary = version => [
      version.mode, version.ai, version.author, version.authorId, version.doc.title
    ];
    // A `beforeLocalize` handler marks the localized document as AI
    // written on demand, the way a translation provider does
    let markAi = false;
    beforeEach(function () {
      markAi = false;
      apos.article.on('beforeLocalize', 'markAiOnDemand', (req, doc) => {
        if (markAi) {
          doc._ai = true;
        }
      });
    });

    it('should record an AI version attributed to the editor when a handler marks the localization', async function () {
      const article = await apos.article.insert(editor(), { title: 'Article' });
      const en = await versionsIn('en', article);
      const req = editor();

      markAi = true;
      await apos.article.localize(req, await findDraft('en', article), 'fr');
      markAi = false;
      await apos.article.localize(req, await findDraft('en', article), 'en-US');

      assert.equal(req.aposAi, undefined);
      assert.deepEqual(
        (await versionsIn('fr', article)).map(summary),
        [ [ 'draft', true, 'Alice', 'alice-id', 'Article' ] ]
      );
      assert.deepEqual(
        (await versionsIn('en-US', article)).map(summary),
        [ [ 'draft', false, 'Alice', 'alice-id', 'Article' ] ]
      );
      assert.deepEqual(await versionsIn('en', article), en);
      const fr = await findDraft('fr', article);
      assert.equal(fr._ai, undefined);
      assert.equal((await versionsIn('fr', article))[0].doc._ai, undefined);
    });

    it('should start an AI version when the localization updates an existing document', async function () {
      const article = await apos.article.insert(editor(), { title: 'Article' });
      await apos.article.localize(editor(), await findDraft('en', article), 'fr');
      await apos.article.update(editor(), {
        ...await findDraft('en', article),
        title: 'Article v2'
      });

      markAi = true;
      await apos.article.localize(editor(), await findDraft('en', article), 'fr', {
        update: true
      });

      assert.deepEqual(
        (await versionsIn('fr', article)).map(summary),
        [
          [ 'draft', true, 'Alice', 'alice-id', 'Article v2' ],
          [ 'draft', false, 'Alice', 'alice-id', 'Article' ]
        ]
      );
    });
  });
});
