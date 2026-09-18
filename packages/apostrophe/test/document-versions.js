const assert = require('assert').strict;
const {
  t,
  moduleName,
  bootstrap: bootstrapWith,
  removeUploads,
  cleanup,
  getReq,
  destroy,
  upload,
  addUser,
  login,
  seedVersionsFor,
  wait
} = require('./utils/document-versions.js');

const bootstrap = (config) => bootstrapWith({
  root: module,
  ...config
});

describe('Document Versions', function () {
  this.timeout(t.timeout);

  describe('first boot', function() {
    let apos;

    before(async function() {
      // attach the modules to get rid of the warnings
      apos = await bootstrap({
        modules: {
          article: {},
          'article-page': {},
          'default-page': {}
        }
      });
    });

    after(async function() {
      await removeUploads();
      await destroy(apos);
    });

    it('should create versions for home and global on a first boot', async function() {
      const module = apos.docVersions;
      assert.strictEqual(module.__meta.name, moduleName);

      const versions = await apos.docVersions.find(getReq(apos), {});
      assert.strictEqual(versions.length, 4);
      const home = versions.filter(v => v.doc.type === '@apostrophecms/home-page');
      const global = versions.filter(v => v.doc.type === '@apostrophecms/global');
      // Parked documents are inserted as drafts and published at once, and
      // the publish takes over the draft version, so each starts with one
      // publication point
      assert.deepStrictEqual(home.map(v => v.mode), [ 'published' ]);
      assert.deepStrictEqual(global.map(v => v.mode), [ 'published' ]);
    });

  });

  describe('`autopublish` and `versions` options', function() {
    let apos;

    before(async function() {
      apos = await bootstrap({
        modules: {
          article: {},
          'article-page': {},
          'default-page': {},
          'module-autopublish_true': {},
          'module-autopublish_true-versions_true': {},
          'module-versions_false': {}
        }
      });
    });

    after(async function() {
      await destroy(apos);
    });

    it('should not have versions enabled for doc types with `autopublish: true`', async function() {
      assert.equal(
        await apos.docVersions.canHaveVersion(getReq(apos), {
          aposMode: 'published',
          type: 'module-autopublish_true'
        }),
        false
      );
    });

    it('should record only published saves for doc types with `versions: false`', async function() {
      assert.equal(
        await apos.docVersions.canHaveVersion(getReq(apos), {
          aposMode: 'published',
          type: 'module-versions_false'
        }),
        true
      );
      assert.equal(
        await apos.docVersions.canHaveVersion(getReq(apos), {
          aposMode: 'draft',
          type: 'module-versions_false'
        }),
        false
      );
    });

    it('should have versions enabled for doc types with `autopublish: true` and `versions: true`', async function() {
      assert.equal(
        await apos.docVersions.canHaveVersion(getReq(apos), {
          aposMode: 'published',
          type: 'module-autopublish_true-versions_true'
        }),
        true
      );

      const req = getReq(apos, {
        _id: 1,
        username: 'user'
      });

      const piece = await apos.modules['module-autopublish_true-versions_true'].insert(req, {
        title: 'a title'
      });
      assert(piece);

      {
        const versions = await apos.docVersions.find(req, {});
        const found = versions
          .filter(version => version.doc.type === 'module-autopublish_true-versions_true')
          .find(version => version.doc.title === 'a title');

        assert(found);
      }

      const updated = await apos.modules['module-autopublish_true-versions_true'].update(req, {
        ...piece,
        title: 'a title v2'
      });
      assert(updated);

      {
        const versions = await apos.docVersions.find(req, {});
        const found = versions
          .filter(version => version.doc.type === 'module-autopublish_true-versions_true')
          .find(version => version.doc.title === 'a title v2');

        assert(found);
      }
    });
  });

  describe('default', function() {
    let apos;

    before(async function() {
      apos = await bootstrap({
        modules: {
          article: {},
          'article-page': {},
          'default-page': {}
        }
      });
    });

    after(async function() {
      await removeUploads();
      await destroy(apos);
    });

    beforeEach(async function() {
      await cleanup(apos);
    });

    it('should add version docs (pieces)', async function() {
      // Fix deepEqual issues (undefined vs null)
      const req = getReq(apos, {
        _id: 1,
        username: 'user'
      });

      const article = await apos.article.insert(req, {
        title: 'An article'
      });
      assert(article);

      // Inserting in published mode writes the draft first, then publishes;
      // the publish takes over the draft version
      {
        const versions = await apos.docVersions.find(req, {});
        assert.strictEqual(versions.length, 1);
        const [ published ] = versions;
        assert.deepStrictEqual(published.doc, article);
        assert.strictEqual(published.mode, 'published');
      }

      const updated = await apos.article.update(req, {
        ...article,
        title: 'An article v2'
      });
      assert(updated);
      {
        const versions = await apos.docVersions.find(req, {});
        assert.strictEqual(versions.length, 2);
        const [ first, second ] = versions;
        assert.deepStrictEqual(first.doc, updated);
        assert.deepStrictEqual(second.doc, article);
      }
    });

    it('should add version docs per document instance (pieces)', async function() {
      // Fix deepEqual issues (undefined vs null)
      const req = getReq(apos, {
        _id: 1,
        username: 'user'
      });

      const article1 = await apos.article.insert(req, {
        title: 'Article 1'
      });
      const article2 = await apos.article.insert(req, {
        title: 'Article 2'
      });
      assert(article1);
      assert(article2);

      const updated1 = await apos.article.update(req, {
        ...article1,
        title: 'Article 1 v2'
      });
      const updated2 = await apos.article.update(req, {
        ...article2,
        title: 'Article 2 v2'
      });
      assert(updated1);
      assert(updated2);

      {
        const versions = await apos.docVersions
          .find(req, apos.docVersions.getTimelineCriteria(article1));
        assert.strictEqual(versions.length, 2);
        const [ first, second ] = versions;

        assert.deepStrictEqual(first.doc, updated1);
        assert.deepStrictEqual(second.doc, article1);
      }

      {
        const versions = await apos.docVersions
          .find(req, apos.docVersions.getTimelineCriteria(article2));
        assert.strictEqual(versions.length, 2);
        const [ first, second ] = versions;

        assert.deepStrictEqual(first.doc, updated2);
        assert.deepStrictEqual(second.doc, article2);
      }
    });

    it('should add version docs (piece pages)', async function() {
      // Fix deepEqual issues (undefined vs null)
      const req = getReq(apos, {
        _id: 1,
        username: 'user'
      });

      const page = await apos.doc.insert(req, {
        title: 'An article page',
        type: 'article-page'
      });
      assert(page);

      let versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 1);
      assert.deepStrictEqual(versions[0].doc, page);

      const updated = await apos.doc.update(req, {
        ...page,
        title: 'An article page v2'
      });
      assert(updated);

      versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 2);
      const [ first, second ] = versions;

      assert.deepStrictEqual(first.doc, updated);
      assert.deepStrictEqual(second.doc, page);
    });

    it('should add version docs per document instance (piece pages)', async function() {
    // Fix deepEqual issues (undefined vs null)
      const req = getReq(apos, {
        _id: 1,
        username: 'user'
      });

      const page1 = await apos.doc.insert(req, {
        title: 'Article page 1',
        type: 'article-page'
      });
      const page2 = await apos.doc.insert(req, {
        title: 'Article page 2',
        type: 'article-page'
      });
      assert(page1);
      assert(page2);

      const updated1 = await apos.doc.update(req, {
        ...page1,
        title: 'Article page 1 v2'
      });
      const updated2 = await apos.doc.update(req, {
        ...page2,
        title: 'Article page 2 v2'
      });
      assert(updated1);
      assert(updated2);

      {
        const versions = await apos.docVersions
          .find(req, apos.docVersions.getTimelineCriteria(page1));
        assert.strictEqual(versions.length, 2);
        const [ first, second ] = versions;

        assert.deepStrictEqual(first.doc, updated1);
        assert.deepStrictEqual(second.doc, page1);
      }

      {
        const versions = await apos.docVersions
          .find(req, apos.docVersions.getTimelineCriteria(page2));
        assert.strictEqual(versions.length, 2);
        const [ first, second ] = versions;

        assert.deepStrictEqual(first.doc, updated2);
        assert.deepStrictEqual(second.doc, page2);
      }
    });

    it('should add version docs (pages)', async function() {
      // Fix deepEqual issues (undefined vs null)
      const req = getReq(apos, {
        _id: 1,
        username: 'user'
      });

      const page = await apos.doc.insert(req, {
        title: 'A page',
        type: 'default-page'
      });
      assert(page);

      let versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 1);
      assert.deepStrictEqual(versions[0].doc, page);

      const updated = await apos.doc.update(req, {
        ...page,
        title: 'A page v2'
      });
      assert(updated);

      versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 2);
      const [ first, second ] = versions;

      assert.deepStrictEqual(first.doc, updated);
      assert.deepStrictEqual(second.doc, page);
    });

    it('should add version docs per document instance (pages)', async function() {
    // Fix deepEqual issues (undefined vs null)
      const req = getReq(apos, {
        _id: 1,
        username: 'user'
      });

      const page1 = await apos.doc.insert(req, {
        title: 'Page 1',
        type: 'default-page'
      });
      const page2 = await apos.doc.insert(req, {
        title: 'Page 2',
        type: 'default-page'
      });
      assert(page1);
      assert(page2);

      const updated1 = await apos.doc.update(req, {
        ...page1,
        title: 'Page 1 v2'
      });
      const updated2 = await apos.doc.update(req, {
        ...page2,
        title: 'Page 2 v2'
      });
      assert(updated1);
      assert(updated2);

      {
        const versions = await apos.docVersions
          .find(req, apos.docVersions.getTimelineCriteria(page1));
        assert.strictEqual(versions.length, 2);
        const [ first, second ] = versions;

        assert.deepStrictEqual(first.doc, updated1);
        assert.deepStrictEqual(second.doc, page1);
      }

      {
        const versions = await apos.docVersions
          .find(req, apos.docVersions.getTimelineCriteria(page2));
        assert.strictEqual(versions.length, 2);
        const [ first, second ] = versions;

        assert.deepStrictEqual(first.doc, updated2);
        assert.deepStrictEqual(second.doc, page2);
      }
    });

    it('should purge all versions when the doc is permanently deleted', async function() {
      const limit = apos.docVersions.defaultLimit;
      const count = limit + 1;
      const seed = await seedVersionsFor(apos, {
        ...apos.article.newInstance(),
        title: 'An article'
      }, count);
      assert(seed.doc);
      assert(seed.versions);
      assert.equal(seed.versions.length, count);

      await apos.article.publish(apos.task.getReq({ mode: 'draft' }), seed.doc);
      let articleModesCount = await apos.doc.db.countDocuments({
        aposDocId: seed.doc.aposDocId
      });
      assert.equal(articleModesCount, 2);

      // ARCHIVE AND REMOVE
      let req = apos.task.getReq({ mode: 'published' });
      const published = await apos.article.find(req, {
        _id: seed.doc._id.replace(':draft', ':published')
      }).toObject();
      await apos.article.update(req, {
        ...published,
        archived: true
      });
      // Delete the draft
      req = apos.task.getReq({ mode: 'draft' });
      const draft = await apos.article.find(req, {
        _id: seed.doc._id.replace(':published', ':draft')
      }).toObject();
      await apos.article.delete(req, draft);

      // Verify
      articleModesCount = await apos.doc.db.countDocuments({
        aposDocId: draft.aposDocId
      });
      const versionCount = await apos.docVersions.db.countDocuments(
        apos.docVersions.getTimelineCriteria(draft)
      );
      assert.strictEqual(articleModesCount, 0);
      assert.strictEqual(versionCount, 0);
    });
  });

  // A type marked `versions: false` keeps its publication points only: the
  // current one and the one before it, which Unpublish returns to. Nothing
  // else is recorded for it and it has no versions UI
  describe('published only', function() {
    let apos;
    let jarAdmin;

    before(async function() {
      apos = await bootstrap({
        modules: {
          article: {
            options: { versions: false }
          },
          'article-page': {
            options: { versions: false }
          },
          'default-page': {
            options: { versions: false }
          }
        }
      });
      await addUser(apos, 'admin');
      jarAdmin = await login(apos, 'admin');
    });

    after(async function() {
      await removeUploads();
      await destroy(apos);
    });

    beforeEach(async function() {
      await cleanup(apos);
    });

    it('should keep the two newest publication points and no draft (pieces)', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'An article' });
      assert.deepEqual(await modes(apos, draft), []);

      await apos.article.publish(req, draft);
      assert.deepEqual(await modes(apos, draft), [ 'published' ]);

      const v2 = await apos.article.update(req, {
        ...draft,
        title: 'An article v2'
      });
      assert.deepEqual(await modes(apos, draft), [ 'published' ]);

      await apos.article.publish(req, v2);
      assert.deepEqual(await titles(apos, draft), [ 'An article v2', 'An article' ]);

      const v3 = await apos.article.update(req, {
        ...v2,
        title: 'An article v3'
      });
      await apos.article.publish(req, v3);
      assert.deepEqual(await titles(apos, draft), [ 'An article v3', 'An article v2' ]);
      assert.deepEqual(await modes(apos, draft), [ 'published', 'published' ]);
    });

    it('should keep the two newest publication points and no draft (piece pages)', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.page.insert(req, '_home', 'lastChild', {
        type: 'article-page',
        title: 'An article page',
        slug: '/articles'
      });
      assert.deepEqual(await modes(apos, draft), []);

      await apos.page.publish(req, draft);
      const v2 = await apos.page.update(req, {
        ...draft,
        title: 'An article page v2'
      });
      await apos.page.publish(req, v2);
      const v3 = await apos.page.update(req, {
        ...v2,
        title: 'An article page v3'
      });
      assert.deepEqual(await titles(apos, draft), [ 'An article page v2', 'An article page' ]);

      await apos.page.publish(req, v3);
      assert.deepEqual(await titles(apos, draft), [ 'An article page v3', 'An article page v2' ]);
      assert.deepEqual(await modes(apos, draft), [ 'published', 'published' ]);
    });

    it('should keep the two newest publication points and no draft (pages)', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.page.insert(req, '_home', 'lastChild', {
        type: 'default-page',
        title: 'A page',
        slug: '/a-page'
      });
      assert.deepEqual(await modes(apos, draft), []);

      await apos.page.publish(req, draft);
      const v2 = await apos.page.update(req, {
        ...draft,
        title: 'A page v2'
      });
      await apos.page.publish(req, v2);
      const v3 = await apos.page.update(req, {
        ...v2,
        title: 'A page v3'
      });
      assert.deepEqual(await titles(apos, draft), [ 'A page v2', 'A page' ]);

      await apos.page.publish(req, v3);
      assert.deepEqual(await titles(apos, draft), [ 'A page v3', 'A page v2' ]);
      assert.deepEqual(await modes(apos, draft), [ 'published', 'published' ]);
    });

    it('should release the attachment references of a dropped publication point', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const attachment = await upload('clone.txt', apos);
      const draft = await apos.article.insert(req, {
        title: 'An article',
        attachment
      });
      await apos.article.publish(req, draft);
      const [ first ] = await timeline(apos, draft, { raw: true });
      const findAttachment = () => apos.attachment.db.findOne({ _id: attachment._id });
      {
        const { archivedDocIds } = await findAttachment();
        assert.deepEqual(archivedDocIds, [ first._id ]);
      }

      const v2 = await apos.article.update(req, {
        ...draft,
        title: 'An article v2',
        attachment: null
      });
      await apos.article.publish(req, v2);
      // Among the versions, only the first publication point holds the attachment now
      {
        const { archivedDocIds } = await findAttachment();
        assert.deepEqual(archivedDocIds, [ first._id ]);
      }

      const v3 = await apos.article.update(req, {
        ...v2,
        title: 'An article v3'
      });
      await apos.article.publish(req, v3);
      assert.deepEqual(await titles(apos, draft), [ 'An article v3', 'An article v2' ]);
      // Dropping that publication point left nothing holding the attachment
      assert.strictEqual(await findAttachment(), null);
    });

    it('should keep Unpublish', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'An article' });
      await apos.article.publish(req, draft);
      const v2 = await apos.article.update(req, {
        ...draft,
        title: 'An article v2'
      });
      await apos.article.publish(req, v2);
      const [ , previous ] = await timeline(apos, draft);

      const publishedReq = getReq(apos, { mode: 'published' });
      let published = await apos.article.findOneForEditing(publishedReq, {
        aposDocId: draft.aposDocId
      });
      published = await apos.article.revertPublishedToPrevious(publishedReq, published);
      assert.strictEqual(published.title, 'An article');

      // The restored publication point and the one it replaced, nothing older
      const versions = await timeline(apos, draft);
      assert.deepEqual(versions.map(version => version.doc.title), [ 'An article', 'An article v2' ]);
      assert.deepEqual(versions[0].restoredFrom, {
        _id: previous._id,
        createdAt: previous.createdAt
      });
      assert.strictEqual(versions[1].restoredFrom, undefined);
    });

    // What the admin bar reads to decide between Unpublish and Undo Publish
    // is the document's `lastPublishedAt` before the publish, so a document
    // that carried one must have a publication point to return to
    it('should have a publication point to return to exactly when the document was published before', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'First' });
      assert(!draft.lastPublishedAt);

      const first = await apos.article.publish(req, draft);
      const publishedReq = getReq(apos, { mode: 'published' });
      const find = () => apos.article.findOneForEditing(publishedReq, {
        aposDocId: draft.aposDocId
      });
      await assert.rejects(
        apos.article.revertPublishedToPrevious(publishedReq, await find()),
        { name: 'invalid' }
      );

      assert(first.lastPublishedAt);
      await apos.article.publish(req, await apos.article.update(req, {
        ...first,
        title: 'Second'
      }));
      const published = await apos.article
        .revertPublishedToPrevious(publishedReq, await find());
      assert.equal(published.title, 'First');
    });

    it('should answer not found on the versions routes', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'An article' });
      await apos.article.publish(req, draft);
      const [ version ] = await timeline(apos, draft, { raw: true });
      assert(version);

      await assert.rejects(
        apos.http.get(`/api/v1/${moduleName}`, {
          qs: { docId: draft._id },
          jar: jarAdmin
        }),
        { status: 404 }
      );
      await assert.rejects(
        apos.http.get(`/api/v1/${moduleName}/${version._id}`, { jar: jarAdmin }),
        { status: 404 }
      );
    });

    it('should report no versions to the browser', function() {
      const req = getReq(apos);
      assert.strictEqual(apos.article.getBrowserData(req).versions, false);
      assert.strictEqual(apos.modules['default-page'].getBrowserData(req).versions, false);
    });

    async function modes(apos, doc) {
      return (await timeline(apos, doc)).map(version => version.mode);
    }

    async function titles(apos, doc) {
      return (await timeline(apos, doc)).map(version => version.doc.title);
    }
  });

  describe('not localized', function() {
    let apos;

    before(async function() {
      apos = await bootstrap({
        modules: {
          article: {
            options: { localized: false }
          },
          'article-page': {
            options: { localized: false }
          },
          'default-page': {
            options: { localized: false }
          }
        }
      });
    });

    after(async function() {
      await removeUploads();
      await destroy(apos);
    });

    beforeEach(async function() {
      await cleanup(apos);
    });

    it('should not add version docs when not localized (pieces)', async function() {
      const req = getReq(apos);

      const article = await apos.article.insert(req, {
        title: 'An article'
      });
      assert(article);

      {
        const versions = await apos.docVersions.find(req, {});
        assert.strictEqual(versions.length, 0);
      }

      const updated = await apos.article.update(req, {
        ...article,
        title: 'An article v2'
      });
      assert(updated);
      {
        const versions = await apos.docVersions.find(req, {});
        assert.strictEqual(versions.length, 0);
      }
    });

    it('should not add version docs when not localized (piece pages)', async function() {
      const req = getReq(apos);

      const page = await apos.doc.insert(req, {
        title: 'An article page',
        type: 'article-page'
      });
      assert(page);

      let versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 0);

      const updated = await apos.doc.update(req, {
        ...page,
        title: 'An article page v2'
      });
      assert(updated);

      versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 0);
    });

    it('should not add version docs when not localized (pages)', async function() {
      const req = getReq(apos);

      const page = await apos.doc.insert(req, {
        title: 'A page',
        type: 'default-page'
      });
      assert(page);

      let versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 0);

      const updated = await apos.doc.update(req, {
        ...page,
        title: 'A page v2'
      });
      assert(updated);

      versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 0);
    });
  });

  describe('auto publish', function() {
    let apos;

    before(async function() {
      apos = await bootstrap({
        modules: {
          article: {
            options: { autopublish: true }
          },
          'article-page': {
            options: { autopublish: true }
          },
          'default-page': {
            options: { autopublish: true }
          }
        }
      });
    });

    after(async function() {
      await removeUploads();
      await destroy(apos);
    });

    beforeEach(async function() {
      await cleanup(apos);
    });

    it('should not add version docs when autopublished (pieces)', async function() {
      const req = getReq(apos);

      const article = await apos.article.insert(req, {
        title: 'An article'
      });
      assert(article);

      {
        const versions = await apos.docVersions.find(req, {});
        assert.strictEqual(versions.length, 0);
      }

      const updated = await apos.article.update(req, {
        ...article,
        title: 'An article v2'
      });
      assert(updated);
      {
        const versions = await apos.docVersions.find(req, {});
        assert.strictEqual(versions.length, 0);
      }
    });

    it('should not add version docs when autopublished (piece pages)', async function() {
      const req = getReq(apos);

      const page = await apos.page.insert(req, '_home', 'firstChild', {
        title: 'An article page',
        type: 'article-page',
        aposMode: 'draft',
        aposLocale: 'en:draft'
      });
      assert(page);

      let versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 0);

      const updated = await apos.doc.update(req, {
        ...page,
        title: 'An article page v2'
      });
      assert(updated);

      versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 0);
    });

    it('should not add version docs when autopublished (pages)', async function() {
      const req = getReq(apos);

      const page = await apos.page.insert(req, '_home', 'firstChild', {
        title: 'A page',
        type: 'default-page',
        aposMode: 'draft',
        aposLocale: 'en:draft'
      });
      assert(page);

      let versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 0);

      const updated = await apos.doc.update(req, {
        ...page,
        title: 'A page v2'
      });
      assert(updated);

      versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 0);
    });
  });

  describe('attachments', function() {
    let apos;

    before(async function() {
      apos = await bootstrap({
        modules: {
          article: {},
          'article-page': {},
          'default-page': {}
        }
      });
    });

    after(async function() {
      await removeUploads();
      await destroy(apos);
    });

    beforeEach(async function() {
      await cleanup(apos);
    });

    it('should have a reference with an attachment', async function() {
      const req = getReq(apos);
      const attachment1 = await upload('clone.txt', apos);
      const attachment2 = await upload('clone.txt', apos);
      assert.strictEqual(attachment1.archivedDocIds.length, 0);
      assert.strictEqual(attachment2.archivedDocIds.length, 0);

      const article = await apos.article.insert(req, {
        title: 'An article',
        attachment: attachment1
      });
      assert(article);

      // Reference of attachment1 to version1
      const attachment1After1 = await apos.attachment.db
        .findOne({ _id: attachment1._id });
      const [ version1 ] = await apos.docVersions.find(
        req,
        apos.docVersions.getTimelineCriteria(article),
        {
          project: { _id: 1 }
        }
      );
      assert(version1);
      assert.deepStrictEqual(attachment1After1.archivedDocIds, [ version1._id ]);

      // Update to version2, same attachment
      const updated1 = await apos.article.update(req, {
        ...article,
        title: 'An article v2'
      });
      assert(updated1);

      // Reference of attachment1 to version1 and version2
      const attachment1After2 = await apos.attachment.db
        .findOne({ _id: attachment1._id });
      const version2 = await apos.docVersions.findOne(
        req,
        apos.docVersions.getTimelineCriteria(article),
        {
          project: { _id: 1 }
        }
      );
      assert(version2);
      assert.notStrictEqual(version2._id, version1._id);

      assert.strictEqual(attachment1After2.archivedDocIds.length, 2);
      assert(attachment1After2.archivedDocIds.includes(version1._id));
      assert(attachment1After2.archivedDocIds.includes(version2._id));

      // Update to version3, switch to attachment2
      const updated2 = await apos.article.update(req, {
        ...article,
        title: 'An article v3',
        attachment: attachment2
      });
      assert(updated2);

      // Reference of attachment1 to version1 and version2
      // Reference of attachment2 to version3
      const attachment1After3 = await apos.attachment.db
        .findOne({ _id: attachment1._id });
      const attachment2After3 = await apos.attachment.db
        .findOne({ _id: attachment2._id });
      const version3 = await apos.docVersions.findOne(
        req,
        apos.docVersions.getTimelineCriteria(article),
        {
          project: { _id: 1 }
        }
      );
      assert(version3);
      assert.notStrictEqual(version3._id, version2._id);

      assert.strictEqual(attachment1After3.archivedDocIds.length, 2);
      assert(attachment1After3.archivedDocIds.includes(version1._id));
      assert(attachment1After3.archivedDocIds.includes(version2._id));
      assert(!attachment1After3.archivedDocIds.includes(version3._id));

      assert.strictEqual(attachment2After3.archivedDocIds.length, 1);
      assert.strictEqual(attachment2After3.archivedDocIds[0], version3._id);
    });

    it('should remove attachment references when purging versions (piece)', async function() {
      let req = apos.task.getReq({ mode: 'draft' });
      let attachment = await upload('clone.txt', apos);
      assert.strictEqual(attachment.archivedDocIds.length, 0);

      // Draft
      let draft = await apos.article.insert(req, {
        title: 'An article',
        attachment
      });
      assert(draft);
      let articleModesCount = await apos.doc.db.countDocuments({
        aposDocId: draft.aposDocId
      });
      assert.strictEqual(articleModesCount, 1);

      // Version 1
      await apos.article.publish(req, draft);
      articleModesCount = await apos.doc.db.countDocuments({
        aposDocId: draft.aposDocId
      });
      assert.strictEqual(articleModesCount, 2);

      // Draft
      draft = await apos.article.update(req, {
        ...draft,
        title: 'An update',
        attachment: null
      });
      articleModesCount = await apos.doc.db.countDocuments({
        aposDocId: draft.aposDocId
      });
      assert.strictEqual(articleModesCount, 2);

      // Version 2
      await apos.article.publish(req, draft);
      articleModesCount = await apos.doc.db.countDocuments({
        aposDocId: draft.aposDocId
      });
      assert.strictEqual(articleModesCount, 2);

      // Validate references: each publish takes over the draft version
      // saved before it
      {
        attachment = await apos.attachment.db.findOne({ _id: attachment._id });
        const versions = await apos.docVersions.find(
          req,
          apos.docVersions.getTimelineCriteria(draft)
        );
        assert.deepStrictEqual(
          versions.map(version => [ version.mode, version.doc.title ]),
          [
            [ 'published', 'An update' ],
            [ 'published', 'An article' ]
          ]
        );
        const [ first, second ] = versions;
        assert.strictEqual(first.doc.attachment, null);
        assert.strictEqual(second.doc.attachment._id, attachment._id);
        assert.deepStrictEqual(attachment.archivedDocIds, [ second._id ]);
      }

      // ARCHIVE AND REMOVE
      req = apos.task.getReq({ mode: 'published' });
      const published = await apos.article.find(req, {
        _id: draft._id.replace(':draft', ':published')
      }).toObject();
      // Archive published
      await apos.article.update(req, {
        ...published,
        archived: true
      });
      // Delete the draft
      req = apos.task.getReq({ mode: 'draft' });
      draft = await apos.article.find(req, {
        _id: draft._id
      }).toObject();
      await apos.article.delete(req, draft);

      // Validate
      articleModesCount = await apos.doc.db.countDocuments({
        aposDocId: draft.aposDocId
      });
      const attachmentCount = await apos.attachment.db
        .countDocuments({ _id: attachment._id });
      const versionCount = await apos.docVersions.db.countDocuments(
        apos.docVersions.getTimelineCriteria(draft)
      );
      assert.strictEqual(articleModesCount, 0);
      assert.strictEqual(attachmentCount, 0);
      assert.strictEqual(versionCount, 0);
    });

    it('should keep the references of an attachment only versions hold on a recount', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const attachment = await upload('clone.txt', apos);
      const draft = await apos.article.insert(req, {
        title: 'With attachment',
        attachment
      });
      await apos.article.publish(req, draft);
      await apos.article.publish(req, await apos.article.update(req, {
        ...draft,
        title: 'Without attachment',
        attachment: null
      }));
      const holders = (await timeline(apos, draft))
        .filter(version => version.doc.attachment)
        .map(version => version._id)
        .sort();
      assert.equal(holders.length, 1);

      await apos.attachment.db.updateOne({ _id: attachment._id }, {
        $set: {
          docIds: [],
          archivedDocIds: []
        }
      });
      await apos.attachment.recomputeAllDocReferences();

      const after = await apos.attachment.db.findOne({ _id: attachment._id });
      assert.deepEqual(after.docIds, []);
      assert.deepEqual([ ...after.archivedDocIds ].sort(), holders);
      assert.equal(after.utilized, true);
    });

    it('should leave the references of an attachment live documents hold unchanged on a recount', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const attachment = await upload('clone.txt', apos);
      const draft = await apos.article.insert(req, {
        title: 'With attachment',
        attachment
      });
      await apos.article.publish(req, draft);
      const before = await apos.attachment.db.findOne({ _id: attachment._id });
      assert.deepEqual(
        [ ...before.docIds ].sort(),
        [ draft._id, draft._id.replace(':draft', ':published') ].sort()
      );
      assert.equal(before.archivedDocIds.length, 1);

      await apos.attachment.recomputeAllDocReferences();

      const after = await apos.attachment.db.findOne({ _id: attachment._id });
      assert.deepEqual([ ...after.docIds ].sort(), [ ...before.docIds ].sort());
      assert.deepEqual(
        [ ...after.archivedDocIds ].sort(),
        [ ...before.archivedDocIds ].sort()
      );
    });

    it('should hand the versions to the recount one at a time from a cursor', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'First' });
      await apos.article.publish(req, draft);
      await apos.article.publish(req, await apos.article.update(req, {
        ...draft,
        title: 'Second'
      }));
      const ids = (await apos.docVersions.db.find({}).toArray())
        .map(version => version._id)
        .sort();
      assert.equal(ids.length, 2);

      // The source must walk a cursor, never read the collection at once
      const { find } = apos.docVersions.db;
      let cursors = 0;
      apos.docVersions.db.find = (...args) => {
        const cursor = find.apply(apos.docVersions.db, args);
        cursor.toArray = () => {
          throw new Error('The versions source read the whole collection');
        };
        cursors++;
        return cursor;
      };
      const seen = [];
      let active = 0;
      let maxActive = 0;
      try {
        await apos.attachment.docSources[moduleName](async doc => {
          active++;
          maxActive = Math.max(maxActive, active);
          await new Promise(resolve => setImmediate(resolve));
          seen.push(doc);
          active--;
        });
      } finally {
        apos.docVersions.db.find = find;
      }

      assert.equal(cursors, 1);
      assert.equal(maxActive, 1);
      assert.deepEqual(seen.map(doc => doc._id).sort(), ids);
      assert(seen.every(doc => doc.archived === true && doc.type === 'article'));
    });
  });

  const hour = 60 * 60 * 1000;

  function draftReqAs(apos, name, options = {}) {
    return getReq(apos, {
      _id: name,
      title: name,
      mode: 'draft',
      ...options
    });
  }

  // The timeline of `doc`, newest first. `raw` keeps `doc` packed, so a
  // replace in place shows as a changed record
  function timeline(apos, doc, { raw = false } = {}) {
    return apos.docVersions.find(
      getReq(apos),
      apos.docVersions.getTimelineCriteria(doc),
      { raw }
    );
  }

  async function saveDraft(apos, req, doc, changes = {}) {
    const draft = await apos.article
      .find(req, { aposDocId: doc.aposDocId })
      .toObject();
    return apos.article.update(req, {
      ...draft,
      ...changes
    });
  }

  // Move the creation of the newest version back by `ms`, the way the clock
  // would have after that long
  async function ageNewestVersion(apos, doc, ms) {
    const [ newest ] = await timeline(apos, doc, { raw: true });
    await apos.docVersions.db.updateOne(
      { _id: newest._id },
      { $set: { createdAt: new Date(newest.createdAt.getTime() - ms) } }
    );
  }

  describe('capture rules', function() {
    let apos;

    before(async function() {
      apos = await bootstrap({
        modules: {
          article: {},
          'default-page': {}
        }
      });
    });

    after(async function() {
      await destroy(apos);
    });

    beforeEach(async function() {
      await cleanup(apos);
    });

    it('should record the first version of a document', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await apos.article.insert(req, { title: 'First' });

      const versions = await timeline(apos, draft);
      assert.deepEqual(
        versions.map(({
          mode, author, authorId, ai, changeCount
        }) => ({
          mode,
          author,
          authorId,
          ai,
          changeCount
        })),
        [
          {
            mode: 'draft',
            author: 'alice',
            authorId: 'alice',
            ai: false,
            changeCount: 0
          }
        ]
      );
    });

    it('should replace the draft version while the same author keeps editing', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await apos.article.insert(req, { title: 'First' });
      const [ first ] = await timeline(apos, draft);

      await saveDraft(apos, req, draft, { title: 'Second' });
      await saveDraft(apos, req, draft, { title: 'Third' });

      const versions = await timeline(apos, draft);
      assert.equal(versions.length, 1);
      assert.equal(versions[0]._id, first._id);
      assert.equal(versions[0].doc.title, 'Third');
      assert.deepEqual(versions[0].createdAt, first.createdAt);
      assert(versions[0].updatedAt > first.createdAt);
    });

    it('should neither record nor update a version for a save without changes', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await apos.article.insert(req, { title: 'First' });
      const before = await timeline(apos, draft, { raw: true });

      await saveDraft(apos, req, draft);
      assert.deepEqual(await timeline(apos, draft, { raw: true }), before);

      const explicitReq = draftReqAs(apos, 'alice', { aposExplicitSave: true });
      await saveDraft(apos, explicitReq, draft);
      assert.deepEqual(await timeline(apos, draft, { raw: true }), before);

      const saved = await apos.article.find(req, { _id: draft._id }).toObject();
      assert.equal(await apos.docVersions.canHaveVersion(explicitReq, saved), false);
    });

    it('should start a version on an explicit save', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await apos.article.insert(req, { title: 'First' });

      await saveDraft(
        apos,
        draftReqAs(apos, 'alice', { aposExplicitSave: true }),
        draft,
        { title: 'Saved' }
      );

      const versions = await timeline(apos, draft);
      assert.deepEqual(versions.map(version => version.doc.title), [ 'Saved', 'First' ]);
    });

    it('should turn the draft version into the publication point on publish', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await apos.article.insert(req, { title: 'First' });
      const saved = await saveDraft(apos, req, draft, { title: 'Second' });
      const [ before ] = await timeline(apos, draft);
      assert.equal(before.mode, 'draft');
      assert.equal(before.changeCount, 0);

      await wait(2);
      await apos.article.publish(req, saved);

      const versions = await timeline(apos, draft);
      assert.equal(versions.length, 1);
      const [ published ] = versions;
      assert.equal(published._id, before._id);
      assert.equal(published.mode, 'published');
      assert.equal(published.doc._id, `${draft.aposDocId}:en:published`);
      assert.equal(published.doc.aposMode, 'published');
      assert.equal(published.doc.title, 'Second');
      assert.equal(published.authorId, 'alice');
      assert.equal(published.changeCount, 0);
      assert(published.createdAt > before.createdAt);
      assert.equal(published.updatedAt, undefined);
    });

    it('should keep the change count of a promoted draft against the version before it', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await apos.article.insert(req, { title: 'First' });
      await apos.article.publish(req, draft);
      await saveDraft(apos, req, draft, { title: 'Second' });
      await saveDraft(apos, req, draft, { int: 5 });
      await apos.article.publish(req, await saveDraft(apos, req, draft));

      const versions = await timeline(apos, draft);
      assert.deepEqual(
        versions.map(version => [ version.mode, version.doc.title, version.changeCount ]),
        [ [ 'published', 'Second', 2 ], [ 'published', 'First', 0 ] ]
      );
    });

    it('should record a publish of another author\'s draft as its own version', async function() {
      const draft = await apos.article.insert(draftReqAs(apos, 'bob'), { title: 'By Bob' });

      await apos.article.publish(draftReqAs(apos, 'alice'), draft);

      const versions = await timeline(apos, draft);
      assert.deepEqual(
        versions.map(version => [ version.mode, version.authorId, version.changeCount ]),
        [ [ 'published', 'alice', 0 ], [ 'draft', 'bob', 0 ] ]
      );
    });

    it('should record a publish of an AI draft as its own version', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await apos.article.insert(req, { title: 'First' });
      const saved = await saveDraft(apos, req.clone({ aposAi: true }), draft, { title: 'By AI' });

      await apos.article.publish(req, saved);

      const versions = await timeline(apos, draft);
      assert.deepEqual(
        versions.map(version => [ version.mode, version.ai, version.doc.title ]),
        [ [ 'published', false, 'By AI' ], [ 'draft', true, 'By AI' ], [ 'draft', false, 'First' ] ]
      );
    });

    it('should record a publish as its own version when the draft version is behind the draft', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await apos.article.insert(req, { title: 'First' });
      const saved = await saveDraft(apos, req.clone({ aposSkipVersion: true }), draft, {
        title: 'Unrecorded'
      });

      await apos.article.publish(req, saved);

      const versions = await timeline(apos, draft);
      assert.deepEqual(
        versions.map(version => [ version.mode, version.doc.title, version.changeCount ]),
        [ [ 'published', 'Unrecorded', 1 ], [ 'draft', 'First', 0 ] ]
      );
    });

    it('should record a publish of a restored draft as its own version', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await apos.article.insert(req, { title: 'First' });
      await apos.article.publish(req, draft);
      await saveDraft(apos, req, draft, { title: 'Second' });
      const [ , first ] = await timeline(apos, draft);
      await saveDraft(apos, req.clone({ aposRestoreVersion: first._id }), draft, { title: 'First' });
      const [ restored ] = await timeline(apos, draft);
      assert.equal(restored.restoredFrom._id, first._id);

      await apos.article.publish(req, await saveDraft(apos, req, draft));

      const versions = await timeline(apos, draft);
      assert.deepEqual(
        versions.map(version => [
          version.mode,
          version.doc.title,
          Boolean(version.restoredFrom)
        ]),
        [
          [ 'published', 'First', false ],
          [ 'draft', 'First', true ],
          [ 'draft', 'Second', false ],
          [ 'published', 'First', false ]
        ]
      );
    });

    it('should start a draft version after a publish and leave the publish untouched', async function() {
      const article = await apos.article.insert(getReq(apos, {
        _id: 'alice',
        title: 'alice'
      }), { title: 'First' });
      const [ published ] = await timeline(apos, article, { raw: true });
      assert.equal(published.mode, 'published');

      const req = draftReqAs(apos, 'alice');
      await saveDraft(apos, req, article, { title: 'Second' });
      await saveDraft(apos, req, article, { title: 'Third' });

      const versions = await timeline(apos, article);
      assert.deepEqual(
        versions.map(version => [ version.mode, version.doc.title ]),
        [ [ 'draft', 'Third' ], [ 'published', 'First' ] ]
      );
      const [ , publishedAfter ] = await timeline(apos, article, { raw: true });
      assert.deepEqual(publishedAfter, published);
    });

    it('should recompute the change count of a replaced version against the one before it', async function() {
      const article = await apos.article.insert(getReq(apos, {
        _id: 'alice',
        title: 'alice'
      }), { title: 'First' });
      const req = draftReqAs(apos, 'alice');

      await saveDraft(apos, req, article, { title: 'Second' });
      assert.equal((await timeline(apos, article))[0].changeCount, 1);

      await saveDraft(apos, req, article, { int: 5 });
      assert.equal((await timeline(apos, article))[0].changeCount, 2);
    });

    it('should start a version when another author saves', async function() {
      const draft = await apos.article.insert(draftReqAs(apos, 'alice'), { title: 'First' });

      await saveDraft(apos, draftReqAs(apos, 'bob'), draft, { title: 'By Bob' });
      await saveDraft(apos, draftReqAs(apos, 'alice'), draft, { title: 'By Alice' });

      const versions = await timeline(apos, draft);
      assert.deepEqual(
        versions.map(version => [ version.authorId, version.author, version.doc.title ]),
        [
          [ 'alice', 'alice', 'By Alice' ],
          [ 'bob', 'bob', 'By Bob' ],
          [ 'alice', 'alice', 'First' ]
        ]
      );
    });

    it('should record a system save as another author without an id', async function() {
      const draft = await apos.article.insert(draftReqAs(apos, 'alice'), { title: 'First' });

      await saveDraft(apos, apos.task.getReq({ mode: 'draft' }), draft, { title: 'By a task' });

      const [ newest, previous ] = await timeline(apos, draft);
      assert.equal(previous.doc.title, 'First');
      assert.equal(newest.authorId, null);
      assert.equal(newest.author, 'System Task');
      assert.equal(newest.doc.title, 'By a task');
    });

    it('should start a version when AI involvement changes', async function() {
      const draft = await apos.article.insert(draftReqAs(apos, 'alice'), { title: 'First' });
      const aiReq = draftReqAs(apos, 'alice', { aposAi: true });

      await saveDraft(apos, aiReq, draft, { title: 'AI 1' });
      await saveDraft(apos, aiReq, draft, { title: 'AI 2' });
      await saveDraft(apos, draftReqAs(apos, 'alice'), draft, { title: 'Human' });

      const versions = await timeline(apos, draft);
      assert.deepEqual(
        versions.map(version => [ version.ai, version.doc.title ]),
        [
          [ false, 'Human' ],
          [ true, 'AI 2' ],
          [ false, 'First' ]
        ]
      );
    });

    it('should start a version at each AI boundary of a request that mixes both', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await apos.article.insert(req, { title: 'First' });

      await saveDraft(apos, req, draft, { title: 'Manual' });
      await saveDraft(apos, req.clone({ aposAi: true }), draft, { title: 'AI' });
      await saveDraft(apos, req, draft, { title: 'Manual again' });

      assert.equal(req.aposAi, undefined);
      const versions = await timeline(apos, draft);
      assert.deepEqual(
        versions.map(version => [ version.authorId, version.ai, version.doc.title ]),
        [
          [ 'alice', false, 'Manual again' ],
          [ 'alice', true, 'AI' ],
          [ 'alice', false, 'Manual' ]
        ]
      );
    });

    it('should attribute an AI version to the user who initiated it', async function() {
      const req = getReq(apos, {
        _id: 'alice-id',
        title: 'Alice',
        mode: 'draft'
      });
      const draft = await apos.article.insert(req, { title: 'First' });
      const aiReq = req.clone({ aposAi: true });

      const saved = await saveDraft(apos, aiReq, draft, { title: 'AI draft' });
      await apos.article.publish(aiReq, saved);

      const versions = await timeline(apos, draft);
      assert.deepEqual(
        versions.map(version => [
          version.mode,
          version.author,
          version.authorId,
          version.ai,
          version.doc.title
        ]),
        [
          [ 'published', 'Alice', 'alice-id', true, 'AI draft' ],
          [ 'draft', 'Alice', 'alice-id', false, 'First' ]
        ]
      );
    });

    it('should start a version once a day has passed since the previous one', async function() {
      assert.equal(apos.docVersions.options.draftInterval, 24 * hour);
      const req = draftReqAs(apos, 'alice');
      const draft = await apos.article.insert(req, { title: 'First' });

      await ageNewestVersion(apos, draft, 23 * hour);
      await saveDraft(apos, req, draft, { title: 'Same day' });
      await ageNewestVersion(apos, draft, 2 * hour);
      await saveDraft(apos, req, draft, { title: 'Next day' });

      const versions = await timeline(apos, draft);
      assert.deepEqual(versions.map(version => version.doc.title), [ 'Next day', 'Same day' ]);
    });
  });

  describe('archive round trip', function() {
    let apos;

    before(async function() {
      apos = await bootstrap({
        modules: {
          article: {},
          'default-page': {},
          'module-versions_false': {}
        }
      });
    });

    after(async function() {
      await destroy(apos);
    });

    beforeEach(async function() {
      // The shared cleanup removes the archive page too, and `page.archive`
      // needs it
      await apos.doc.db.deleteMany({
        type: {
          $not: {
            $in: [
              '@apostrophecms/home-page',
              '@apostrophecms/global',
              '@apostrophecms/user',
              '@apostrophecms/archive-page'
            ]
          }
        }
      });
      await apos.docVersions.db.deleteMany({});
    });

    // A piece published twice, so the timeline holds two publication points
    async function publishTwice(manager, req) {
      const draft = await manager.insert(req, { title: 'First' });
      await manager.publish(req, draft);
      await manager.update(req, {
        ...await findDraft(manager, req, draft),
        title: 'Second'
      });
      await manager.publish(req, await findDraft(manager, req, draft));
      return draft;
    }

    function findDraft(manager, req, doc) {
      return manager.find(req, { aposDocId: doc.aposDocId }).archived(null).toObject();
    }

    async function setArchived(manager, req, doc, archived) {
      return manager.update(req, {
        ...await findDraft(manager, req, doc),
        archived
      });
    }

    it('should leave the timeline of a piece as it was', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await publishTwice(apos.article, req);
      const before = await timeline(apos, draft, { raw: true });
      assert.deepEqual(before.map(version => version.mode), [ 'published', 'published' ]);

      await setArchived(apos.article, req, draft, true);
      const archived = await findDraft(apos.article, req, draft);
      assert(archived.slug.startsWith(`deduplicate-${draft.aposDocId}-`));
      assert.deepEqual(await timeline(apos, draft, { raw: true }), before);

      await setArchived(apos.article, req, draft, false);
      const restored = await findDraft(apos.article, req, draft);
      assert.equal(restored.slug, 'first');
      assert.equal(restored.archived, false);
      assert.deepEqual(await timeline(apos, draft, { raw: true }), before);
    });

    it('should leave the timeline of a page as it was', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await apos.page.insert(req, '_home', 'lastChild', {
        type: 'default-page',
        title: 'First',
        slug: '/first'
      });
      await apos.page.publish(req, draft);
      await apos.page.update(req, {
        ...await findDraft(apos.page, req, draft),
        title: 'Second'
      });
      await apos.page.publish(req, await findDraft(apos.page, req, draft));
      const before = await timeline(apos, draft, { raw: true });
      assert.deepEqual(before.map(version => version.mode), [ 'published', 'published' ]);

      await apos.page.archive(req, draft._id);
      const archived = await findDraft(apos.page, req, draft);
      assert.equal(archived.archived, true);
      assert(archived.slug.endsWith(`-deduplicate-${draft.aposDocId}`));
      assert.deepEqual(await timeline(apos, draft, { raw: true }), before);

      const home = await apos.page.find(req, { level: 0 }).toObject();
      await apos.page.move(req, draft._id, home._id, 'lastChild');
      const restored = await findDraft(apos.page, req, draft);
      assert.equal(restored.slug, '/first');
      assert(!restored.archived);
      assert.deepEqual(await timeline(apos, draft, { raw: true }), before);
    });

    it('should leave the publication points of a `versions: false` type as they were', async function() {
      const manager = apos.modules['module-versions_false'];
      const req = draftReqAs(apos, 'alice');
      const draft = await publishTwice(manager, req);
      const before = await timeline(apos, draft, { raw: true });
      assert.deepEqual(before.map(version => version.mode), [ 'published', 'published' ]);

      await setArchived(manager, req, draft, true);
      await setArchived(manager, req, draft, false);
      const restored = await findDraft(manager, req, draft);
      assert.equal(restored.slug, 'first');
      assert.deepEqual(await timeline(apos, draft, { raw: true }), before);
    });

    it('should still record an editorial save that changes the slug', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await publishTwice(apos.article, req);

      await apos.article.update(req, {
        ...await findDraft(apos.article, req, draft),
        slug: 'renamed'
      });

      const [ newest ] = await timeline(apos, draft);
      assert.equal(newest.mode, 'draft');
      assert.equal(newest.doc.slug, 'renamed');
      assert.equal(newest.changeCount, 1);
    });

    it('should record one version for one move to the last child of the home page', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const home = await apos.page.find(req, { level: 0 }).toObject();
      const page = await apos.page.insert(req, '_home', 'lastChild', {
        type: 'default-page',
        title: 'Page',
        slug: '/page'
      });
      await apos.page.publish(req, page);
      await apos.page.insert(req, '_home', 'lastChild', {
        type: 'default-page',
        title: 'Peer',
        slug: '/peer'
      });
      const before = await timeline(apos, page);
      assert.deepEqual(before.map(version => version.mode), [ 'published' ]);

      // The archive stays the last child of the home page, so the move is
      // redirected before it
      const { changed } = await apos.page.move(req, page._id, home._id, 'lastChild');
      assert(changed.every(change => change._id));

      // The draft save changes no schema field and records nothing; the
      // published replay of the move records one publication point
      const after = await timeline(apos, page);
      assert.deepEqual(after.map(version => version.mode), [ 'published', 'published' ]);
      assert.deepEqual(after.slice(1), before);
      const archive = await apos.page.find(req, { type: '@apostrophecms/archive-page' })
        .archived(null)
        .toObject();
      const moved = await apos.page.find(req, { _id: page._id }).toObject();
      assert(moved.rank < archive.rank);
    });
  });

  describe('capture rules with a configured interval', function() {
    let apos;

    before(async function() {
      apos = await bootstrap({
        modules: {
          article: {},
          'default-page': {},
          '@apostrophecms/document-versions': {
            options: {
              draftInterval: hour
            }
          }
        }
      });
    });

    after(async function() {
      await destroy(apos);
    });

    it('should start a version once the configured interval has passed', async function() {
      const req = draftReqAs(apos, 'alice');
      const draft = await apos.article.insert(req, { title: 'First' });

      await ageNewestVersion(apos, draft, 30 * 60 * 1000);
      await saveDraft(apos, req, draft, { title: 'Within the hour' });
      await ageNewestVersion(apos, draft, hour);
      await saveDraft(apos, req, draft, { title: 'After the hour' });

      const versions = await timeline(apos, draft);
      assert.deepEqual(
        versions.map(version => version.doc.title),
        [ 'After the hour', 'Within the hour' ]
      );
    });
  });

  describe('unpublish', function() {
    let apos;

    before(async function() {
      apos = await bootstrap({
        modules: {
          article: {},
          'default-page': {}
        }
      });
    });

    after(async function() {
      await destroy(apos);
    });

    beforeEach(async function() {
      await cleanup(apos);
    });

    it('should return the published document to its previous publication and record it', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'First' });
      await apos.article.publish(req, draft);
      const second = await apos.article.update(req, {
        ...draft,
        title: 'Second'
      });
      await apos.article.publish(req, second);
      const [ , previous ] = await publications(apos, draft);
      assert.strictEqual(previous.doc.title, 'First');

      const publishedReq = getReq(apos, { mode: 'published' });
      let published = await apos.article.findOneForEditing(publishedReq, {
        aposDocId: draft.aposDocId
      });
      published = await apos.article.revertPublishedToPrevious(publishedReq, published);
      assert.strictEqual(published.title, 'First');
      assert.deepEqual(published.lastPublishedAt, previous.doc.lastPublishedAt);

      const [ restored, ...rest ] = await publications(apos, draft);
      assert.strictEqual(restored.mode, 'published');
      assert.strictEqual(restored.doc.title, 'First');
      assert.deepEqual(restored.restoredFrom, {
        _id: previous._id,
        createdAt: previous.createdAt
      });
      assert.deepEqual(rest.map(version => version.doc.title), [ 'Second', 'First' ]);

      // The draft is untouched and shows as modified against the reverted publication
      const draftAfter = await apos.article
        .find(req, { aposDocId: draft.aposDocId })
        .toObject();
      assert.strictEqual(draftAfter.title, 'Second');
      assert.strictEqual(draftAfter.modified, true);
    });

    // What the admin bar reads to decide between Unpublish and Undo Publish
    // is the document's `lastPublishedAt` before the publish, so a document
    // that carried one must have a publication point to return to
    it('should have a publication point to return to exactly when the document was published before', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'First' });
      assert(!draft.lastPublishedAt);

      const first = await apos.article.publish(req, draft);
      const publishedReq = getReq(apos, { mode: 'published' });
      const find = () => apos.article.findOneForEditing(publishedReq, {
        aposDocId: draft.aposDocId
      });
      await assert.rejects(
        apos.article.revertPublishedToPrevious(publishedReq, await find()),
        { name: 'invalid' }
      );

      assert(first.lastPublishedAt);
      await apos.article.publish(req, await apos.article.update(req, {
        ...first,
        title: 'Second'
      }));
      const published = await apos.article
        .revertPublishedToPrevious(publishedReq, await find());
      assert.equal(published.title, 'First');
    });

    it('should refuse a second Unpublish until the next publish', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'First' });
      await apos.article.publish(req, draft);
      const second = await apos.article.update(req, {
        ...draft,
        title: 'Second'
      });
      await apos.article.publish(req, second);

      const publishedReq = getReq(apos, { mode: 'published' });
      const find = () => apos.article.findOneForEditing(publishedReq, {
        aposDocId: draft.aposDocId
      });
      await apos.article.revertPublishedToPrevious(publishedReq, await find());
      await assert.rejects(
        apos.article.revertPublishedToPrevious(publishedReq, await find()),
        { name: 'invalid' }
      );

      const third = await apos.article.update(req, {
        ...second,
        title: 'Third'
      });
      await apos.article.publish(req, third);
      const [ , restored ] = await publications(apos, draft);
      assert(restored.restoredFrom);

      const published = await apos.article
        .revertPublishedToPrevious(publishedReq, await find());
      assert.strictEqual(published.title, 'First');
      const [ newest ] = await publications(apos, draft);
      assert.strictEqual(newest.restoredFrom._id, restored._id);
    });

    it('should refuse Unpublish when there is no previous publication', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'First' });
      await apos.article.publish(req, draft);

      const publishedReq = getReq(apos, { mode: 'published' });
      const published = await apos.article.findOneForEditing(publishedReq, {
        aposDocId: draft.aposDocId
      });
      await assert.rejects(
        apos.article.revertPublishedToPrevious(publishedReq, published),
        { name: 'invalid' }
      );
      assert.strictEqual((await publications(apos, draft)).length, 1);
    });

    it('should return a published page to its previous publication with one new record', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.page.insert(req, '_home', 'lastChild', {
        type: 'default-page',
        title: 'First',
        slug: '/first'
      });
      await apos.page.publish(req, draft);
      const second = await apos.page.update(req, {
        ...draft,
        title: 'Second'
      });
      await apos.page.publish(req, second);
      const [ , previous ] = await publications(apos, draft);

      const publishedReq = getReq(apos, { mode: 'published' });
      let published = await apos.page.findOneForEditing(publishedReq, {
        aposDocId: draft.aposDocId
      });
      published = await apos.page.revertPublishedToPrevious(publishedReq, published);
      assert.strictEqual(published.title, 'First');
      assert.strictEqual(published.slug, '/first');

      // The page's place in the tree is replayed after the revert without
      // recording a publication of its own
      const versions = await publications(apos, draft);
      assert.deepEqual(versions.map(version => version.doc.title), [ 'First', 'Second', 'First' ]);
      assert.deepEqual(versions[0].restoredFrom, {
        _id: previous._id,
        createdAt: previous.createdAt
      });
      await assert.rejects(
        apos.page.revertPublishedToPrevious(publishedReq, published),
        { name: 'invalid' }
      );
    });

    // The published records of `doc`, newest first
    async function publications(apos, doc) {
      return (await timeline(apos, doc)).filter(version => version.mode === 'published');
    }
  });

  describe('legacy previous mode documents', function() {
    let apos;

    before(async function() {
      apos = await bootstrap({
        modules: {
          article: {},
          'default-page': {}
        }
      });
    });

    after(async function() {
      await removeUploads();
      await destroy(apos);
    });

    beforeEach(async function() {
      await cleanup(apos);
    });

    it('should seed the publication points a `previous` document and the live content hold', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'First' });
      await apos.article.publish(req, draft);
      await apos.article.publish(req, await apos.article.update(req, {
        ...draft,
        title: 'Second'
      }));
      const previous = await toLegacy(apos, draft);

      await apos.docVersions.seedPublicationPoints();
      assert.equal(await apos.docVersions.removePreviousModeDocs(), 1);

      const versions = await publications(apos, draft);
      assert.deepEqual(versions.map(version => version.doc.title), [ 'Second', 'First' ]);
      assert.deepEqual(versions.map(version => version.mode), [ 'published', 'published' ]);
      // The `previous` document's identity and slug are the published ones
      assert.equal(versions[1].doc._id, `${draft.aposDocId}:en:published`);
      assert.equal(versions[1].doc.aposMode, 'published');
      assert.equal(versions[1].doc.slug, 'first');
      // The slug the core before this module deduplicated to store it
      assert.equal(previous.slug, `deduplicate-${draft.aposDocId}-first`);
      assert(versions[1].createdAt < versions[0].createdAt);
      assert.equal(await apos.doc.db.countDocuments({ _id: previous._id }), 0);
    });

    it('should seed the publication points of a page and keep it in the tree', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.page.insert(req, '_home', 'lastChild', {
        type: 'default-page',
        title: 'First',
        slug: '/first'
      });
      await apos.page.publish(req, draft);
      await apos.page.publish(req, await apos.page.update(req, {
        ...draft,
        title: 'Second'
      }));
      const previous = await toLegacy(apos, draft);

      await apos.docVersions.seedPublicationPoints();
      assert.equal(await apos.docVersions.removePreviousModeDocs(), 1);

      const versions = await publications(apos, draft);
      assert.deepEqual(versions.map(version => version.doc.title), [ 'Second', 'First' ]);
      // Page types deduplicate their slug with a suffix, not a prefix
      assert.equal(previous.slug, `/first-deduplicate-${draft.aposDocId}`);
      assert.equal(versions[1].doc.slug, '/first');
      assert.equal(versions[1].doc.path, versions[0].doc.path);
      assert.equal(versions[1].doc.rank, versions[0].doc.rank);
      assert.equal(await apos.doc.db.countDocuments({ _id: previous._id }), 0);

      // The page the revert writes is still where it was in the tree
      const publishedReq = getReq(apos, { mode: 'published' });
      const published = await apos.page.revertPublishedToPrevious(
        publishedReq,
        await apos.page.findOneForEditing(publishedReq, { aposDocId: draft.aposDocId })
      );
      assert.equal(published.title, 'First');
      assert.equal(published.path, versions[0].doc.path);
    });

    it('should seed the live content of a document published once', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'First' });
      await apos.article.publish(req, draft);
      assert.equal(await toLegacy(apos, draft), null);

      await apos.docVersions.seedPublicationPoints();

      const versions = await publications(apos, draft);
      assert.deepEqual(versions.map(version => version.doc.title), [ 'First' ]);
    });

    it('should let Unpublish return to the content live at the upgrade', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'First' });
      await apos.article.publish(req, draft);
      await toLegacy(apos, draft);
      await apos.docVersions.seedPublicationPoints();
      await apos.docVersions.removePreviousModeDocs();

      await apos.article.publish(req, await apos.article.update(req, {
        ...draft,
        title: 'Second'
      }));

      const publishedReq = getReq(apos, { mode: 'published' });
      const published = await apos.article.revertPublishedToPrevious(
        publishedReq,
        await apos.article.findOneForEditing(publishedReq, { aposDocId: draft.aposDocId })
      );
      assert.equal(published.title, 'First');
    });

    it('should leave a timeline that already holds a publication point alone', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'First' });
      await apos.article.publish(req, draft);
      await apos.article.publish(req, await apos.article.update(req, {
        ...draft,
        title: 'Second'
      }));
      const before = await timeline(apos, draft);
      const previous = await stalePreviousDoc(apos, draft, before[before.length - 1].doc);

      await apos.docVersions.seedPublicationPoints();
      assert.equal(await apos.docVersions.removePreviousModeDocs(), 1);

      assert.deepEqual(
        (await timeline(apos, draft)).map(version => version._id),
        before.map(version => version._id)
      );
      assert.equal(await apos.doc.db.countDocuments({ _id: previous._id }), 0);
    });

    it('should move the attachment references of a `previous` document to the version it becomes', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const attachment = await upload('upload_image.png', apos);
      const draft = await apos.article.insert(req, {
        title: 'First',
        attachment
      });
      await apos.article.publish(req, draft);
      await apos.article.publish(req, await apos.article.update(req, {
        ...draft,
        title: 'Second',
        attachment: null
      }));
      const previous = await toLegacy(apos, draft);
      // What the core before this module left behind: the `previous`
      // document is a live holder of the attachment
      await apos.attachment.recomputeAllDocReferences();
      let stored = await apos.attachment.db.findOne({ _id: attachment._id });
      assert(stored.docIds.includes(previous._id));

      await apos.docVersions.seedPublicationPoints();
      await apos.docVersions.removePreviousModeDocs();

      const [ , seeded ] = await publications(apos, draft);
      stored = await apos.attachment.db.findOne({ _id: attachment._id });
      assert(!stored.docIds.includes(previous._id));
      assert(!stored.archivedDocIds.includes(previous._id));
      assert(stored.archivedDocIds.includes(seeded._id));
      // Held by versions only, so it stays stored and out of the web
      assert.equal(stored.archived, true);
    });

    // The state a project upgrading from the `previous` mode arrives in: the
    // content live before the newest publish is a document with a
    // deduplicated slug, and the store holds nothing. Returns that document,
    // `null` when the timeline has only one publication
    async function toLegacy(apos, doc) {
      const [ , previous ] = await publications(apos, doc);
      await apos.docVersions.db.deleteMany({});
      return previous
        ? stalePreviousDoc(apos, doc, previous.doc)
        : null;
    }

    // What the old `publish` wrote: the content live until then, with its
    // conflicting fields deduplicated as that core deduplicated them
    async function stalePreviousDoc(apos, doc, content) {
      const req = getReq(apos, { mode: 'published' });
      const manager = apos.doc.getManager(content.type);
      const previous = {
        ...content,
        ...await manager.getDeduplicationSet(req, content),
        _id: `${doc.aposDocId}:en:previous`,
        aposLocale: 'en:previous',
        aposMode: 'previous'
      };
      await apos.doc.db.insertOne(previous);
      return previous;
    }

    // The published records of `doc`, newest first
    async function publications(apos, doc) {
      return (await timeline(apos, doc)).filter(version => version.mode === 'published');
    }
  });

  describe('document id changes', function() {
    let apos;

    before(async function() {
      apos = await bootstrap({
        modules: {
          '@apostrophecms/i18n': {
            options: {
              locales: {
                en: {},
                fr: {
                  prefix: '/fr'
                }
              }
            }
          },
          article: {},
          'default-page': {},
          'article-note': {
            extend: '@apostrophecms/piece-type',
            fields: {
              add: {
                _articles: {
                  type: 'relationship',
                  withType: 'article',
                  fields: {
                    add: {
                      note: {
                        type: 'string'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
    });

    after(async function() {
      await removeUploads();
      await destroy(apos);
    });

    beforeEach(async function() {
      await cleanup(apos);
    });

    it('should move the versions of a renamed piece and restore from them', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'First' });
      await apos.article.publish(req, draft);
      await apos.article.publish(req, await apos.article.update(req, {
        ...draft,
        title: 'Second'
      }));
      const before = await timeline(apos, draft);
      assert.equal(before.length, 2);

      await apos.doc.setAposDocId({
        newId: 'renamed-article',
        oldId: draft.aposDocId,
        locale: 'en'
      });

      assert.equal(
        await apos.docVersions.db.countDocuments({ docId: draft.aposDocId }),
        0
      );
      const renamed = await apos.article.find(req, { aposDocId: 'renamed-article' }).toObject();
      const after = await timeline(apos, renamed);
      assert.deepEqual(
        after.map(version => [ version._id, version.mode, version.doc.title ]),
        before.map(version => [ version._id, version.mode, version.doc.title ])
      );
      for (const version of after) {
        assert.equal(version.doc._id, `renamed-article:en:${version.mode}`);
        assert.equal(version.doc.aposDocId, 'renamed-article');
        assert.equal(version.doc.aposLocale, `en:${version.mode}`);
      }

      // Unpublish returns to the previous publication point
      const publishedReq = getReq(apos, { mode: 'published' });
      const published = await apos.article.revertPublishedToPrevious(
        publishedReq,
        await apos.article.findOneForEditing(publishedReq, { aposDocId: 'renamed-article' })
      );
      assert.equal(published.title, 'First');

      // A draft restore names the version it returns to
      const [ , oldest ] = after;
      await apos.article.update(req.clone({ aposRestoreVersion: oldest._id }), {
        ...renamed,
        title: oldest.doc.title
      });
      const [ restored ] = await timeline(apos, renamed);
      assert.equal(restored.mode, 'draft');
      assert.equal(restored.doc.title, 'First');
      assert.equal(restored.restoredFrom._id, oldest._id);
    });

    it('should rewrite the path of a renamed page in its versions', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.page.insert(req, '_home', 'lastChild', {
        type: 'default-page',
        title: 'Page',
        slug: '/page'
      });
      await apos.page.publish(req, draft);
      assert(draft.path.endsWith(draft.aposDocId));

      await apos.doc.setAposDocId({
        newId: 'renamed-page',
        oldId: draft.aposDocId,
        locale: 'en'
      });

      const renamed = await apos.page.find(req, { aposDocId: 'renamed-page' }).toObject();
      assert.equal(renamed.path, draft.path.replace(draft.aposDocId, 'renamed-page'));
      const versions = await timeline(apos, renamed);
      assert.deepEqual(versions.map(version => version.mode), [ 'published' ]);
      for (const version of versions) {
        assert.equal(version.doc._id, `renamed-page:en:${version.mode}`);
        assert.equal(version.doc.path, renamed.path);
      }
    });

    it('should remove the versions of a renamed document and release their attachments when it is deleted', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const attachment = await upload('clone.txt', apos);
      const draft = await apos.article.insert(req, {
        title: 'With attachment',
        attachment
      });
      await apos.article.publish(req, draft);
      await apos.doc.setAposDocId({
        newId: 'renamed-article',
        oldId: draft.aposDocId,
        locale: 'en'
      });
      const criteria = {
        docId: 'renamed-article',
        locale: 'en'
      };
      const versionIds = (await apos.docVersions.db.find(criteria).toArray())
        .map(version => version._id)
        .sort();
      assert.equal(versionIds.length, 1);
      const held = await apos.attachment.db.findOne({ _id: attachment._id });
      assert.deepEqual([ ...held.archivedDocIds ].sort(), versionIds);

      const publishedReq = getReq(apos, { mode: 'published' });
      const published = await apos.article.find(publishedReq, {
        aposDocId: 'renamed-article'
      }).toObject();
      await apos.article.update(publishedReq, {
        ...published,
        archived: true
      });
      const renamed = await apos.article.find(req, {
        aposDocId: 'renamed-article'
      }).archived(null).toObject();
      await apos.article.delete(req, renamed);

      assert.equal(await apos.doc.db.countDocuments({ aposDocId: 'renamed-article' }), 0);
      assert.equal(await apos.docVersions.db.countDocuments(criteria), 0);
      assert.equal(await apos.attachment.db.countDocuments({ _id: attachment._id }), 0);
    });

    it('should leave the versions alone when the old document is kept', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const kept = await apos.article.insert(req, { title: 'Kept' });
      const existing = await apos.article.insert(req, { title: 'Existing' });

      await apos.doc.changeDocIds([ [ kept._id, existing._id ] ], { skipReplace: true });

      assert.deepEqual(
        (await timeline(apos, kept)).map(version => version.doc._id),
        [ kept._id ]
      );
      assert.deepEqual(
        (await timeline(apos, existing)).map(version => version.doc._id),
        [ existing._id ]
      );
    });

    it('should resolve versions already under the new id as `keep` says', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const from = await apos.article.insert(req, { title: 'From' });
      const to = await apos.article.insert(req, { title: 'To' });

      await apos.docVersions.changeDocId(from._id, to._id, { keep: 'new' });
      assert.deepEqual(await titles(from), []);
      assert.deepEqual(await titles(to), [ 'To' ]);

      const other = await apos.article.insert(req, { title: 'Other' });
      await apos.docVersions.changeDocId(other._id, to._id, { keep: 'old' });
      assert.deepEqual(await titles(other), []);
      assert.deepEqual(await titles(to), [ 'Other' ]);

      async function titles(doc) {
        return (await timeline(apos, doc)).map(version => version.doc.title);
      }
    });

    it('should leave the versions of a locale rename to `renameLocale`', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const draft = await apos.article.insert(req, { title: 'Article' });
      const [ version ] = await timeline(apos, draft, { raw: true });

      assert.equal(
        await apos.docVersions.changeDocId(draft._id, draft._id.replace(':en:', ':fr:')),
        0
      );
      assert.deepEqual(await timeline(apos, draft, { raw: true }), [ version ]);
    });

    it('should rewrite the ancestor id in the versions of a renamed page\'s descendants', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const parent = await apos.page.insert(req, '_home', 'lastChild', {
        type: 'default-page',
        title: 'Parent',
        slug: '/parent'
      });
      await apos.page.publish(req, parent);
      const child = await apos.page.insert(req, parent._id, 'lastChild', {
        type: 'default-page',
        title: 'Child',
        slug: '/parent/child'
      });
      await apos.page.publish(req, child);
      const grandchild = await apos.page.insert(req, child._id, 'lastChild', {
        type: 'default-page',
        title: 'Grandchild',
        slug: '/parent/child/grandchild'
      });
      const other = await apos.page.insert(req, '_home', 'lastChild', {
        type: 'default-page',
        title: 'Other',
        slug: '/other'
      });
      const otherBefore = await timeline(apos, other, { raw: true });

      await apos.doc.setAposDocId({
        newId: 'renamed-parent',
        oldId: parent.aposDocId,
        locale: 'en'
      });

      const liveChild = await apos.page
        .find(req, { aposDocId: child.aposDocId })
        .toObject();
      const liveGrandchild = await apos.page
        .find(req, { aposDocId: grandchild.aposDocId })
        .toObject();
      assert(liveChild.path.includes('/renamed-parent/'));
      const childVersions = await timeline(apos, child);
      assert.deepEqual(childVersions.map(version => version.mode), [ 'published' ]);
      for (const version of childVersions) {
        assert.equal(version.doc.path, liveChild.path);
      }
      const [ grandchildVersion ] = await timeline(apos, grandchild);
      assert.equal(grandchildVersion.doc.path, liveGrandchild.path);
      // A page outside the subtree is untouched, byte for byte
      assert.deepEqual(await timeline(apos, other, { raw: true }), otherBefore);
    });

    it('should keep the relationships of other documents\' versions to a renamed document', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const category = await apos.article.insert(req, { title: 'Category' });
      const article = await apos.article.insert(req, {
        title: 'Article',
        _related: [ category ]
      });
      await apos.article.publish(req, article);
      // A save that drops the relationship: the version from before it still
      // points at the category, while `relatedReverseIds` no longer names
      // the article
      await apos.article.update(req, {
        ...await apos.article.findOneForEditing(req, { aposDocId: article.aposDocId }),
        _related: []
      });
      const unrelated = await apos.article.insert(req, { title: 'Unrelated' });
      const unrelatedBefore = await timeline(apos, unrelated, { raw: true });

      await apos.doc.setAposDocId({
        newId: 'renamed-category',
        oldId: category.aposDocId,
        locale: 'en'
      });

      const versions = await timeline(apos, article);
      assert.deepEqual(
        versions.map(version => [ version.mode, version.doc.relatedIds ]),
        [
          [ 'draft', [] ],
          [ 'published', [ 'renamed-category' ] ]
        ]
      );
      assert.deepEqual(await timeline(apos, unrelated, { raw: true }), unrelatedBefore);

      // Restoring the version from before the relationship was dropped keeps
      // it: the modal PUTs the content `getOne` returns, relationships joined
      const [ , published ] = versions;
      const { doc: content } = await apos.docVersions.getOne(req, published._id);
      assert.deepEqual(content._related.map(related => related.title), [ 'Category' ]);
      const draft = await apos.article.findOneForEditing(req, {
        aposDocId: article.aposDocId
      });
      await apos.article.convert(req, content, draft);
      await apos.article.update(req.clone({ aposRestoreVersion: published._id }), draft);
      const restored = await apos.article
        .find(req, { aposDocId: article.aposDocId })
        .toObject();
      assert.deepEqual(restored._related.map(related => related.title), [ 'Category' ]);
      assert.deepEqual(restored.relatedIds, [ 'renamed-category' ]);
      const renamed = await apos.doc.db.findOne({ _id: 'renamed-category:en:draft' });
      assert.deepEqual(renamed.relatedReverseIds, [ article.aposDocId ]);
    });

    it('should rename the relationship fields of other documents\' versions to a renamed document', async function() {
      const req = getReq(apos, { mode: 'draft' });
      const notes = apos.modules['article-note'];
      const article = await apos.article.insert(req, { title: 'Article' });
      const note = await notes.insert(req, {
        title: 'Note',
        _articles: [
          {
            ...article,
            _fields: { note: 'Kept' }
          }
        ]
      });
      await notes.publish(req, note);

      await apos.doc.setAposDocId({
        newId: 'renamed-article',
        oldId: article.aposDocId,
        locale: 'en'
      });

      const live = await apos.doc.db.findOne({ _id: note._id });
      assert.deepEqual(live.articlesFields, { 'renamed-article': { note: 'Kept' } });
      const versions = await timeline(apos, note);
      assert.deepEqual(
        versions.map(version => [
          version.mode,
          version.doc.articlesIds,
          version.doc.articlesFields
        ]),
        [ [
          'published',
          [ 'renamed-article' ],
          { 'renamed-article': { note: 'Kept' } }
        ] ]
      );

      // Restored the way the modal does, the relationship keeps its fields
      const [ oldest ] = versions;
      const { doc: content } = await apos.docVersions.getOne(req, oldest._id);
      assert.deepEqual(content._articles.map(related => related._fields), [ { note: 'Kept' } ]);
      const draft = await notes.findOneForEditing(req, { aposDocId: note.aposDocId });
      await notes.convert(req, content, draft);
      await notes.update(req.clone({ aposRestoreVersion: oldest._id }), draft);
      const restored = await notes.find(req, { aposDocId: note.aposDocId }).toObject();
      assert.deepEqual(restored._articles.map(related => related._fields), [ { note: 'Kept' } ]);
      assert.deepEqual(restored.articlesFields, { 'renamed-article': { note: 'Kept' } });
    });

    it('should find the versions of a parked page the duplicate parked pages migration renames', async function() {
      const req = getReq(apos, {
        mode: 'draft',
        locale: 'fr'
      });
      const home = await apos.page.find(req, { level: 0 }).toObject();
      await apos.page.publish(req, await apos.page.update(req, {
        ...home,
        title: 'Accueil'
      }));
      const before = await timeline(apos, home);
      assert.deepEqual(before.map(version => version.mode), [ 'published' ]);

      // A French home page replicated under an id of its own, with its versions
      const misreplicated = 'misreplicated-home';
      for (const mode of [ 'draft', 'published' ]) {
        const doc = await apos.doc.db.findOne({ _id: `${home.aposDocId}:fr:${mode}` });
        await apos.doc.db.removeOne({ _id: doc._id });
        await apos.doc.db.insertOne({
          ...doc,
          _id: `${misreplicated}:fr:${mode}`,
          aposDocId: misreplicated,
          path: misreplicated
        });
      }
      await apos.docVersions.db.updateMany(
        apos.docVersions.getTimelineCriteria(home),
        { $set: { docId: misreplicated } }
      );

      const migration = apos.migration.migrations
        .find(({ name }) => name === 'duplicate-parked-pages');
      await migration.fn();

      assert.equal(await apos.doc.db.countDocuments({ aposDocId: misreplicated }), 0);
      assert.equal(await apos.docVersions.db.countDocuments({ docId: misreplicated }), 0);
      const after = await timeline(apos, home);
      assert.deepEqual(
        after.map(version => [ version._id, version.doc.title ]),
        before.map(version => [ version._id, version.doc.title ])
      );
      for (const version of after) {
        assert.equal(version.doc._id, `${home.aposDocId}:fr:${version.mode}`);
        assert.equal(version.doc.path, home.aposDocId);
      }
    });
  });

  describe('REST API', function() {
    let apos;
    let admin;
    let jarAdmin;
    let editor;
    let jarEditor;
    let jarContributor;

    before(async function() {
      apos = await bootstrap({
        modules: {
          article: {},
          'article-page': {},
          'default-page': {}
        }
      });
      admin = await addUser(apos, 'admin');
      jarAdmin = await login(apos, 'admin');
      editor = await addUser(apos, 'editor');
      jarEditor = await login(apos, 'editor');
      await addUser(apos, 'contributor');
      jarContributor = await login(apos, 'contributor');
      // The first GET sets the CSRF cookie that REST writes need
      await apos.http.get('/', { jar: jarAdmin });
    });

    after(async function() {
      await removeUploads();
      await destroy(apos);
    });

    beforeEach(async function() {
      await cleanup(apos);
    });

    it('should have invalid response if docId query is missing - GET /', async function() {
      await assert.rejects(
        apos.http.get(`/api/v1/${moduleName}`),
        {
          status: 400
        },
        'Expected REST API 400 error but got none'
      );
    });

    it('should have invalid response if docId query is bad - GET /', async function() {
      await assert.rejects(
        apos.http.get(`/api/v1/${moduleName}`, { qs: { docId: '$bad-id' } }),
        {
          status: 400
        },
        'Expected REST API 400 error but got none'
      );
    });

    it('should have not found response if the doc does not exist - GET /', async function() {
      await assert.rejects(
        apos.http.get(`/api/v1/${moduleName}`, { qs: { docId: 'doesNotExist' } }),
        {
          status: 404
        },
        'Expected REST API 404 error but got none'
      );
    });

    it('should have not found response if no permissions - GET /', async function() {
      const article = await apos.article.insert(getReq(apos), {
        title: 'An article'
      });
      assert(article);

      await assert.rejects(
        apos.http.get(`/api/v1/${moduleName}`, { qs: { docId: article._id } }),
        {
          status: 404
        },
        'Expected REST API 404 error but got none'
      );
    });

    it('should have versions response as admin - GET /', async function() {
      const article = await apos.article.insert(getReq(apos, admin), {
        title: 'An article'
      });
      assert(article);

      const res = await apos.http.get(`/api/v1/${moduleName}`, {
        qs: { docId: article._id },
        jar: jarAdmin
      });
      assert(res);
      const { results: versions } = res;
      assert(versions);

      assert.equal(versions.length, 1);
      assert(versions[0]._id);
      assert(versions[0].createdAt);
      assert.equal(versions[0].author, admin.title);
      assert.deepEqual(
        Object.keys(versions[0]).sort(),
        [ '_id', 'ai', 'author', 'authorId', 'changeCount', 'createdAt', 'mode' ]
      );
    });

    it('should have versions response as editor - GET /', async function() {
      const article = await apos.article.insert(getReq(apos, editor), {
        title: 'An article'
      });
      assert(article);

      const res = await apos.http.get(`/api/v1/${moduleName}`, {
        qs: { docId: article._id },
        jar: jarEditor
      });
      assert(res);
      const { results: versions } = res;
      assert(versions);

      assert.equal(versions.length, 1);
      assert(versions[0]._id);
      assert(versions[0].createdAt);
      assert.equal(versions[0].author, editor.title);
      assert.deepEqual(
        Object.keys(versions[0]).sort(),
        [ '_id', 'ai', 'author', 'authorId', 'changeCount', 'createdAt', 'mode' ]
      );
    });

    it('should have versions response as contributor - GET /', async function() {
      const article = await apos.article.insert(getReq(apos), {
        title: 'An article'
      });
      assert(article);

      const res = await apos.http.get(`/api/v1/${moduleName}`, {
        qs: { docId: article._id },
        jar: jarContributor
      });
      assert(res);
      const { results: versions } = res;
      assert(versions);
      assert.equal(versions.length, 1);
      assert(versions[0]._id);
      assert(versions[0].createdAt);
      assert.deepEqual(
        Object.keys(versions[0]).sort(),
        [ '_id', 'ai', 'author', 'authorId', 'changeCount', 'createdAt', 'mode' ]
      );
    });

    it('should have default sort - GET /', async function() {
      const count = 3;
      const seed = await seedVersionsFor(apos, {
        ...apos.article.newInstance(),
        title: 'An article'
      }, count);
      assert(seed.doc);
      assert(seed.versions);

      const versions = await apos.http.get(`/api/v1/${moduleName}`, {
        qs: { docId: seed.doc._id },
        jar: jarAdmin
      });
      assert(versions);
      assert.equal(seed.versions.length, count);
      assert.equal(versions.total, count);
      assert.equal(versions.results.length, count);
      const [ third, second, first ] = versions.results;
      assert.equal(seed.versions[0].doc.title, 'An article 3');
      assert.equal(seed.versions[1].doc.title, 'An article 2');
      assert.equal(seed.versions[2].doc.title, 'An article 1');
      assert.equal(third._id, seed.versions[0]._id);
      assert.equal(second._id, seed.versions[1]._id);
      assert.equal(first._id, seed.versions[2]._id);
    });

    it('should have default limit - GET /', async function() {
      const limit = apos.docVersions.defaultLimit;
      const count = limit + 1;
      const seed = await seedVersionsFor(apos, {
        ...apos.article.newInstance(),
        title: 'An article'
      }, count);
      assert(seed.doc);
      assert(seed.versions);

      const versions = await apos.http.get(`/api/v1/${moduleName}`, {
        qs: { docId: seed.doc._id },
        jar: jarAdmin
      });
      assert(versions);
      assert.equal(seed.versions.length, count);
      assert.equal(versions.total, count);
      assert.equal(versions.currentPage, 1);
      assert.equal(versions.perPage, limit);
      assert.equal(versions.results.length, limit);
    });

    it('should support pagination - GET /', async function() {
      const limit = apos.docVersions.defaultLimit;
      const count = limit + 1;
      const seed = await seedVersionsFor(apos, {
        ...apos.article.newInstance(),
        title: 'An article'
      }, count);
      assert(seed.doc);
      assert(seed.versions);

      const versions = await apos.http.get(`/api/v1/${moduleName}`, {
        qs: {
          docId: seed.doc._id,
          page: 2
        },
        jar: jarAdmin
      });
      assert(versions);
      assert.equal(seed.versions.length, count);
      assert.equal(versions.total, count);
      assert.equal(versions.pages, 2);
      assert.equal(versions.currentPage, 2);
      assert.equal(versions.perPage, limit);
      assert.equal(versions.results.length, 1);
    });

    it('should have invalid response if id is bad - GET /:versionId', async function() {
      await assert.rejects(
        apos.http.get(`/api/v1/${moduleName}/$bad-id`),
        {
          status: 400
        },
        'Expected REST API 400 error but got none'
      );
    });

    it('should have not found response if the version does not exist - GET /:versionId', async function() {
      await assert.rejects(
        apos.http.get(`/api/v1/${moduleName}/doesNotExist`),
        {
          status: 404
        },
        'Expected REST API 404 error but got none'
      );
    });

    it('should have not found response if no permissions - GET /:versionId', async function() {
      const article = await apos.article.insert(getReq(apos), {
        title: 'An article'
      });
      assert(article);

      await assert.rejects(
        apos.http.get(`/api/v1/${moduleName}/${article._id}`),
        {
          status: 404
        },
        'Expected REST API 404 error but got none'
      );
    });

    it('should have version response as admin - GET /:versionId', async function() {
      const article = await apos.article.insert(getReq(apos, admin), {
        title: 'An article'
      });
      assert(article);
      const versionDb = await apos.docVersions.findOne(
        getReq(apos),
        apos.docVersions.getTimelineCriteria(article)
      );
      assert(versionDb);
      assert(versionDb._id);

      const version = await apos.http.get(`/api/v1/${moduleName}/${versionDb._id}`, {
        jar: jarAdmin
      });
      assert(version);

      assert(version._id);
      assert(version.createdAt);
      assert.equal(version.author, admin.title);
      assert.equal(version.doc.title, article.title);
      assert.deepEqual(
        Object.keys(version).sort(),
        [ '_id', 'ai', 'author', 'authorId', 'changeCount', 'createdAt', 'doc', 'mode' ]
      );
    });

    it('should have version response as editor - GET /:versionId', async function() {
      const article = await apos.article.insert(getReq(apos, editor), {
        title: 'An article'
      });
      assert(article);
      const versionDb = await apos.docVersions.findOne(
        getReq(apos),
        apos.docVersions.getTimelineCriteria(article)
      );
      assert(versionDb);
      assert(versionDb._id);

      const version = await apos.http.get(`/api/v1/${moduleName}/${versionDb._id}`, {
        jar: jarEditor
      });
      assert(version);

      assert(version._id);
      assert(version.createdAt);
      assert.equal(version.author, editor.title);
      assert.equal(version.doc.title, article.title);
      assert.deepEqual(
        Object.keys(version).sort(),
        [ '_id', 'ai', 'author', 'authorId', 'changeCount', 'createdAt', 'doc', 'mode' ]
      );
    });

    it('should have version response as contributor - GET /:versionId', async function() {
      const article = await apos.article.insert(getReq(apos), {
        title: 'An article'
      });
      assert(article);
      const versionDb = await apos.docVersions.findOne(
        getReq(apos),
        apos.docVersions.getTimelineCriteria(article)
      );
      assert(versionDb);
      assert(versionDb._id);

      const version = await apos.http.get(`/api/v1/${moduleName}/${versionDb._id}`, {
        jar: jarContributor
      });
      assert(version);

      assert(version._id);
      assert(version.createdAt);
      assert.equal(version.doc.title, article.title);
      assert.deepEqual(
        Object.keys(version).sort(),
        [ '_id', 'ai', 'author', 'authorId', 'changeCount', 'createdAt', 'doc', 'mode' ]
      );
    });

    it('should replace the draft version unless `_explicitSave` is sent - PUT /api/v1/article', async function() {
      const inserted = await apos.http.post('/api/v1/article', {
        body: { title: 'First' },
        qs: { aposMode: 'draft' },
        jar: jarAdmin
      });
      const criteria = apos.docVersions.getTimelineCriteria(inserted);
      const put = (body) => apos.http.put(`/api/v1/article/${inserted._id}`, {
        body: {
          ...inserted,
          ...body
        },
        qs: { aposMode: 'draft' },
        jar: jarAdmin
      });
      const titles = async () => (await apos.docVersions.find(getReq(apos), criteria))
        .map(version => version.doc.title)
        .sort();

      await put({ title: 'Autosaved' });
      assert.deepEqual(await titles(), [ 'Autosaved' ]);

      await put({
        title: 'Saved',
        _explicitSave: true
      });
      assert.deepEqual(await titles(), [ 'Autosaved', 'Saved' ]);
    });

    it('should replace the draft version unless `_explicitSave` is sent - PATCH /api/v1/@apostrophecms/page', async function() {
      const inserted = await apos.http.post('/api/v1/@apostrophecms/page', {
        body: {
          title: 'First',
          type: 'default-page',
          _targetId: '_home',
          _position: 'lastChild'
        },
        qs: { aposMode: 'draft' },
        jar: jarAdmin
      });
      const criteria = apos.docVersions.getTimelineCriteria(inserted);
      const patch = (body) => apos.http.patch(`/api/v1/@apostrophecms/page/${inserted._id}`, {
        body,
        qs: { aposMode: 'draft' },
        jar: jarAdmin
      });
      const titles = async () => (await apos.docVersions.find(getReq(apos), criteria))
        .map(version => version.doc.title)
        .sort();

      await patch({ title: 'Autosaved' });
      assert.deepEqual(await titles(), [ 'Autosaved' ]);

      await patch({
        title: 'Saved',
        _explicitSave: true
      });
      assert.deepEqual(await titles(), [ 'Autosaved', 'Saved' ]);
    });

    it('should record a restore as a new version with its origin - PUT /api/v1/article', async function() {
      const inserted = await apos.http.post('/api/v1/article', {
        body: { title: 'Original' },
        qs: { aposMode: 'draft' },
        jar: jarAdmin
      });
      const criteria = apos.docVersions.getTimelineCriteria(inserted);
      const put = (body) => apos.http.put(`/api/v1/article/${inserted._id}`, {
        body: {
          ...inserted,
          ...body
        },
        qs: { aposMode: 'draft' },
        jar: jarAdmin
      });
      const [ original ] = await apos.docVersions.find(getReq(apos), criteria);

      await put({
        title: 'Changed',
        _explicitSave: true
      });
      await put({
        title: 'Original',
        _restoreVersion: original._id
      });

      const versions = await apos.docVersions.find(getReq(apos), criteria);
      assert.equal(versions.length, 3);
      const restored = versions.filter(version => version.restoredFrom);
      assert.equal(restored.length, 1);
      assert.equal(restored[0].doc.title, 'Original');
      assert.deepEqual(restored[0].restoredFrom, {
        _id: original._id,
        createdAt: original.createdAt
      });
    });

    describe('changes', function() {
      // An article with one version per state, oldest first; a state's
      // `ai` saves it with AI, `restoredFrom` as a restore of the first.
      // Returns the article and the version records, oldest first
      async function recordVersions(states) {
        const req = getReq(apos, { mode: 'draft' });
        const [ initial, ...rest ] = states;
        const article = await apos.article.insert(req, {
          title: 'An article',
          ...initial
        });
        const [ first ] = await apos.docVersions.find(
          getReq(apos),
          apos.docVersions.getTimelineCriteria(article)
        );
        const versions = [ first ];
        for (const {
          ai, restoredFrom, ...state
        } of rest) {
          await wait(5);
          const versionReq = req.clone({
            aposAi: ai,
            aposRestoreVersion: restoredFrom && first._id
          });
          versions.push(await apos.docVersions.saveFor(versionReq, {
            ...article,
            ...state
          }, true));
        }
        return {
          article,
          versions
        };
      }

      it('should list the changes of a version since the one before it - GET /:versionId/changes', async function() {
        const related = await apos.article.insert(getReq(apos, admin), {
          title: 'Related'
        });
        const { versions } = await recordVersions([
          {
            int: 1,
            array: [ {
              _id: 'item1',
              label: 'Home',
              value: 'one'
            } ]
          },
          {
            title: 'Renamed',
            int: 1,
            array: [ {
              _id: 'item1',
              label: 'Home',
              value: 'two'
            } ],
            relatedIds: [ related.aposDocId ]
          }
        ]);

        const changes = await apos.http.get(
          `/api/v1/${moduleName}/${versions[1]._id}/changes`,
          { jar: jarAdmin }
        );

        assert.deepEqual(
          changes.rows.map(row => ({
            path: row.path.map(segment => segment.name),
            type: row.type,
            oldText: row.oldText,
            newText: row.newText,
            ai: row.ai
          })),
          [
            {
              path: [ 'title' ],
              type: 'modified',
              oldText: 'An article',
              newText: 'Renamed',
              ai: false
            },
            {
              path: [ '_related' ],
              type: 'added',
              oldText: '',
              newText: 'Related',
              ai: false
            },
            {
              path: [ 'array', 'item1', 'value' ],
              type: 'modified',
              oldText: 'one',
              newText: 'two',
              ai: false
            }
          ]
        );
        assert.equal(changes.rows[2].path[1].label, 'Home');
        assert.deepEqual(changes.rows[0].diff, [
          {
            text: 'An article',
            change: 'removed'
          },
          {
            text: 'Renamed',
            change: 'added'
          }
        ]);
        assert.deepEqual(changes.counts, {
          added: 1,
          modified: 2,
          deleted: 0,
          ai: 0
        });
      });

      it('should flag every change of a version saved with AI - GET /:versionId/changes', async function() {
        const { versions } = await recordVersions([
          {},
          {
            title: 'By AI',
            int: 3,
            ai: true
          }
        ]);

        const changes = await apos.http.get(
          `/api/v1/${moduleName}/${versions[1]._id}/changes`,
          { jar: jarAdmin }
        );

        assert.deepEqual(changes.rows.map(row => row.ai), [ true, true ]);
        assert.deepEqual(changes.counts, {
          added: 1,
          modified: 1,
          deleted: 0,
          ai: 2
        });
      });

      it('should list no changes for a first or restored version - GET /:versionId/changes', async function() {
        const { versions } = await recordVersions([
          {},
          { title: 'Changed' },
          { restoredFrom: true }
        ]);
        const none = {
          rows: [],
          counts: {
            added: 0,
            modified: 0,
            deleted: 0,
            ai: 0
          }
        };

        assert(versions[2].restoredFrom);
        for (const version of [ versions[0], versions[2] ]) {
          const changes = await apos.http.get(
            `/api/v1/${moduleName}/${version._id}/changes`,
            { jar: jarAdmin }
          );
          assert.deepEqual(changes, none);
        }
      });

      it('should have not found response if no permissions - GET /:versionId/changes', async function() {
        const { versions } = await recordVersions([ {}, { title: 'Changed' } ]);

        await assert.rejects(
          apos.http.get(`/api/v1/${moduleName}/${versions[1]._id}/changes`),
          { status: 404 }
        );
        await assert.rejects(
          apos.http.get(`/api/v1/${moduleName}/doesNotExist/changes`, { jar: jarAdmin }),
          { status: 404 }
        );
        await assert.rejects(
          apos.http.get(`/api/v1/${moduleName}/$bad-id/changes`, { jar: jarAdmin }),
          { status: 400 }
        );
      });

      it('should list the changes of a group as one, flagged per path - GET /changes', async function() {
        const { versions } = await recordVersions([
          {},
          {
            title: 'By AI',
            ai: true
          },
          {
            title: 'By AI',
            int: 7
          }
        ]);

        const changes = await apos.http.get(`/api/v1/${moduleName}/changes`, {
          qs: { ids: `${versions[2]._id},${versions[1]._id}` },
          jar: jarAdmin
        });

        assert.deepEqual(
          changes.rows.map(row => [ row.path[0].name, row.type, row.newText, row.ai ]),
          [
            [ 'title', 'modified', 'By AI', true ],
            [ 'int', 'added', '7', false ]
          ]
        );
        assert.deepEqual(changes.counts, {
          added: 1,
          modified: 1,
          deleted: 0,
          ai: 1
        });
      });

      it('should count no changes for a first version in a group - GET /changes', async function() {
        const { versions } = await recordVersions([
          {},
          {
            title: 'By AI',
            ai: true
          }
        ]);

        const group = await apos.http.get(`/api/v1/${moduleName}/changes`, {
          qs: { ids: `${versions[0]._id},${versions[1]._id}` },
          jar: jarAdmin
        });
        const single = await apos.http.get(
          `/api/v1/${moduleName}/${versions[1]._id}/changes`,
          { jar: jarAdmin }
        );

        assert.equal(group.rows.length, 1);
        assert.deepEqual(group, single);
      });

      it('should have invalid response unless the ids are consecutive versions of one document - GET /changes', async function() {
        const { versions } = await recordVersions([
          {},
          { title: 'Two' },
          { title: 'Three' },
          { restoredFrom: true }
        ]);
        const other = await recordVersions([ {}, { title: 'Other' } ]);
        const groups = [
          '',
          `${versions[1]._id},$bad-id`,
          `${versions[0]._id},${versions[2]._id}`,
          `${versions[2]._id},${versions[3]._id}`,
          `${versions[2]._id},${other.versions[1]._id}`
        ];

        for (const ids of groups) {
          await assert.rejects(
            apos.http.get(`/api/v1/${moduleName}/changes`, {
              qs: { ids },
              jar: jarAdmin
            }),
            { status: 400 },
            `Expected 400 for "${ids}"`
          );
        }
        await assert.rejects(
          apos.http.get(`/api/v1/${moduleName}/changes`, {
            qs: { ids: `${versions[1]._id},${versions[2]._id}` }
          }),
          { status: 404 }
        );
      });

      it('should mark the document with its changes on request - GET /:versionId?annotate=1', async function() {
        const { versions } = await recordVersions([
          {},
          { int: 5 }
        ]);
        const url = `/api/v1/${moduleName}/${versions[1]._id}`;
        const highlight = doc => apos.doc.getMeta(doc, '@apostrophecms/schema', 'int', 'highlight');

        const annotated = await apos.http.get(url, {
          qs: { annotate: 1 },
          jar: jarAdmin
        });
        const plain = await apos.http.get(url, { jar: jarAdmin });
        const first = await apos.http.get(`/api/v1/${moduleName}/${versions[0]._id}`, {
          qs: { annotate: 1 },
          jar: jarAdmin
        });

        assert.equal(annotated.doc.int, 5);
        assert.equal(highlight(annotated.doc), true);
        assert.equal(highlight(plain.doc), undefined);
        assert.equal(first.doc.aposMeta, undefined);
      });
    });
  });

  describe('schema', function () {
    let apos;
    let admin;

    beforeEach(async function() {
      apos = await bootstrap({
        modules: {
          article: {},
          'article-page': {},
          'default-page': {}
        }
      });
      admin = await addUser(apos, 'admin');
    });

    afterEach(async function() {
      await removeUploads();
      await destroy(apos);
    });

    it('should add the new schema fields default values to old versions of a document', async function() {
      // Add an article before editing its schema
      const article = await apos.article.insert(getReq(apos, admin), {
        title: 'An article'
      });
      assert(article);

      // Add a new field to the schema with a default value,
      // rebooting on the same database
      await apos.destroy();
      apos = await bootstrap({
        shortName: apos.options.shortName,
        modules: {
          article: {
            fields: {
              add: {
                newField: {
                  type: 'string',
                  label: 'New Field',
                  def: 'default value for newField'
                }
              }
            }
          },
          'article-page': {},
          'default-page': {}
        }
      });

      await apos.article.update(getReq(apos, admin), {
        ...article,
        title: 'An article v2'
      });

      const versions = await apos.docVersions.find(
        getReq(apos),
        apos.docVersions.getTimelineCriteria(article)
      );
      const versionDb = versions.find(version => version.doc.title === 'An article');
      assert(versionDb);
      assert(versionDb._id);

      const jarAdmin = await login(apos, 'admin');
      const version = await apos.http.get(`/api/v1/${moduleName}/${versionDb._id}`, {
        jar: jarAdmin
      });

      assert.equal(version.doc.newField, 'default value for newField');
    });
  });

  describe('set-change-count task', function () {
    let apos;

    before(async function() {
      apos = await bootstrap({
        modules: {
          '@apostrophecms/i18n': {
            options: {
              locales: {
                en: {},
                fr: {
                  prefix: '/fr'
                }
              }
            }
          },
          article: {},
          'default-page': {}
        }
      });
    });

    after(async function() {
      await destroy(apos);
    });

    beforeEach(async function() {
      await cleanup(apos);
    });

    // One document with three published versions in `en` and two in `fr`.
    // Returns the counts recorded at save time, newest first per locale.
    async function seedTimelines() {
      const req = getReq(apos);
      const frReq = getReq(apos, { locale: 'fr' });
      const article = await apos.article.insert(req, { title: 'A1' });
      await apos.article.update(req, {
        ...article,
        title: 'A2'
      });
      await apos.article.update(req, {
        ...article,
        title: 'A3',
        int: 5
      });
      const fr = await apos.article.localize(req, article, 'fr');
      await apos.article.publish(frReq, fr);
      await apos.article.publish(frReq, {
        ...fr,
        title: 'A fr 2'
      });
      return {
        article,
        counts: await countsFor(article)
      };
    }

    async function countsFor(article) {
      const versions = await apos.docVersions.find(
        apos.task.getReq(),
        { docId: article.aposDocId },
        {
          project: {
            locale: 1,
            changeCount: 1
          },
          raw: true
        }
      );
      return {
        en: versions.filter(v => v.locale === 'en').map(v => v.changeCount),
        fr: versions.filter(v => v.locale === 'fr').map(v => v.changeCount)
      };
    }

    it('should recompute every timeline', async function() {
      const { article, counts } = await seedTimelines();
      assert.deepEqual(counts, {
        en: [ 2, 1, 0 ],
        fr: [ 1, 0 ]
      });

      await apos.docVersions.db.updateMany({}, { $set: { changeCount: 99 } });
      await apos.docVersions.setChangeCountTask();

      // The oldest version of a timeline has no predecessor and is left alone
      assert.deepEqual(await countsFor(article), {
        en: [ 2, 1, 99 ],
        fr: [ 1, 99 ]
      });
    });

    it('should recompute one timeline and leave the others alone', async function() {
      const { article } = await seedTimelines();

      await apos.docVersions.db.updateMany({}, { $set: { changeCount: 99 } });
      await apos.docVersions.setChangeCountFor(apos.task.getReq(), {
        docId: article.aposDocId,
        locale: 'fr'
      });

      assert.deepEqual(await countsFor(article), {
        en: [ 99, 99, 99 ],
        fr: [ 1, 99 ]
      });
    });
  });

  describe('compressed records', function () {
    let apos;
    let admin;
    let jarAdmin;

    before(async function() {
      apos = await bootstrap({
        modules: {
          '@apostrophecms/i18n': {
            options: {
              locales: {
                en: {},
                fr: {
                  prefix: '/fr'
                }
              }
            }
          },
          article: {},
          'default-page': {}
        }
      });
      admin = await addUser(apos, 'admin');
      jarAdmin = await login(apos, 'admin');
    });

    after(async function() {
      await removeUploads();
      await destroy(apos);
    });

    beforeEach(async function() {
      await cleanup(apos);
    });

    // Rewrite every stored record in the shape it had before compression:
    // `doc` a plain object, `docId` the full `_id`, no `mode`, `locale`,
    // `authorId` or `ai`
    async function toLegacy() {
      const records = await apos.docVersions.db.find({}).toArray();
      for (const {
        mode, locale, authorId, ai, ...record
      } of records) {
        const doc = await apos.docVersions.unpack(record.doc);
        await apos.docVersions.db.replaceOne({ _id: record._id }, {
          ...record,
          docId: doc._id,
          doc
        });
      }
    }

    function rawRecords() {
      return apos.docVersions.db.find({}).sort({ _id: 1 }).toArray();
    }

    it('should unpack a packed document with its types intact', async function() {
      const doc = {
        _id: 'doc:en:published',
        title: 'Title',
        int: 5,
        float: 1.5,
        boolean: false,
        empty: null,
        updatedAt: new Date('2026-01-02T03:04:05.006Z'),
        main: {
          _id: 'area',
          metaType: 'area',
          items: [
            {
              _id: 'widget',
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              content: '<p>Text</p>'
            }
          ]
        }
      };

      const packed = await apos.docVersions.pack(doc);
      assert.equal(typeof packed, 'string');

      const unpacked = await apos.docVersions.unpack(packed);
      assert.deepEqual(unpacked, doc);
      assert(unpacked.updatedAt instanceof Date);
    });

    it('should refuse to unpack a plain document', async function() {
      await assert.rejects(
        apos.docVersions.unpack({ title: 'Plain' }),
        /Version doc is not packed: run the pending migrations/
      );
    });

    it('should store `doc` packed and the document identity at top level', async function() {
      const req = getReq(apos);
      const article = await apos.article.insert(req, { title: 'Article' });
      const fr = await apos.article.localize(req, article, 'fr');
      await apos.article.publish(getReq(apos, { locale: 'fr' }), fr);

      const records = await apos.docVersions.find(
        apos.task.getReq(),
        { docId: article.aposDocId },
        { raw: true }
      );
      assert.deepEqual(
        records.map(record => [ record.docId, record.mode, record.locale ]).sort(),
        [
          [ article.aposDocId, 'published', 'en' ],
          [ article.aposDocId, 'published', 'fr' ]
        ]
      );
      for (const record of records) {
        assert.equal(typeof record.doc, 'string');
      }
    });

    it('should serve a legacy record identically once migrated', async function() {
      const req = getReq(apos, admin);
      const article = await apos.article.insert(req, {
        title: 'Article',
        int: 1
      });
      await apos.article.update(req, {
        ...article,
        title: 'Article 2',
        int: 2
      });
      const criteria = apos.docVersions.getTimelineCriteria(article);
      const expected = await apos.docVersions.find(apos.task.getReq(), criteria);
      assert.equal(expected.length, 2);
      const expectedRest = await apos.http.get(`/api/v1/${moduleName}/${expected[0]._id}`, {
        jar: jarAdmin
      });

      await toLegacy();
      await assert.rejects(
        apos.docVersions.find(apos.task.getReq(), {}),
        /Version doc is not packed/
      );

      await apos.docVersions.convertLegacyVersions();

      for (const record of await rawRecords()) {
        assert.equal(typeof record.doc, 'string');
        assert(!record.docId.includes(':'));
      }
      assert.deepEqual(
        await apos.docVersions.find(apos.task.getReq(), criteria),
        expected
      );
      assert.deepEqual(
        await apos.http.get(`/api/v1/${moduleName}/${expected[0]._id}`, {
          jar: jarAdmin
        }),
        expectedRest
      );
    });

    it('should convert legacy records only and change nothing on a rerun', async function() {
      await apos.article.insert(getReq(apos, { mode: 'draft' }), { title: 'Legacy' });
      await toLegacy();
      const [ legacy ] = await rawRecords();
      await apos.docVersions.db.insertMany(Array.from({ length: 149 }, (_, i) => ({
        ...legacy,
        _id: `${legacy._id}-${String(i).padStart(3, '0')}`
      })));
      await apos.article.insert(getReq(apos, { mode: 'draft' }), { title: 'Packed' });
      const [ packed ] = await apos.docVersions.db
        .find({ mode: { $exists: true } })
        .toArray();

      assert.equal(await apos.docVersions.convertLegacyVersions(), 150);

      const converted = await rawRecords();
      assert.equal(converted.length, 151);
      assert(converted.every(record => record.mode && typeof record.doc === 'string'));
      assert(converted.every(record => 'authorId' in record && record.ai === false));
      assert.deepEqual(converted.find(record => record._id === packed._id), packed);

      assert.equal(await apos.docVersions.convertLegacyVersions(), 0);
      assert.deepEqual(await rawRecords(), converted);
    });

    it('should convert legacy records written after the migration with the task', async function() {
      await apos.article.insert(getReq(apos, { mode: 'draft' }), { title: 'Late' });
      await toLegacy();

      await apos.task.invoke(`${moduleName}:convert-legacy-versions`);

      const [ record ] = await rawRecords();
      assert.equal(typeof record.doc, 'string');
      assert.equal(record.mode, 'draft');
    });

    it('should take the author of a legacy record from the document it holds', async function() {
      const byAdmin = await apos.article.insert(getReq(apos, admin), { title: 'By admin' });
      const bySystem = await apos.article.insert(apos.task.getReq(), { title: 'By system' });
      await toLegacy();

      await apos.docVersions.convertLegacyVersions();

      const authorIds = async doc => (await apos.docVersions.find(
        apos.task.getReq(),
        apos.docVersions.getTimelineCriteria(doc),
        {
          project: { authorId: 1 },
          raw: true
        }
      )).map(version => version.authorId);
      assert.deepEqual(await authorIds(byAdmin), [ admin._id ]);
      assert.deepEqual(await authorIds(bySystem), [ null ]);
    });

    it('should restore a version recorded before the migration and one after', async function() {
      const req = getReq(apos, admin);
      const article = await apos.article.insert(req, {
        title: 'Before',
        int: 1
      });
      await toLegacy();
      await apos.docVersions.convertLegacyVersions();
      await apos.article.update(req, {
        ...article,
        title: 'After',
        int: 2
      });
      await apos.article.update(req, {
        ...article,
        title: 'Current',
        int: 3
      });
      const [ , after, before ] = await apos.docVersions.find(
        apos.task.getReq(),
        apos.docVersions.getTimelineCriteria(article)
      );

      // The same requests the versions modal makes
      async function restore(version) {
        const { doc } = await apos.http.get(`/api/v1/${moduleName}/${version._id}`, {
          jar: jarAdmin
        });
        return apos.http.put(`/api/v1/article/${article.aposDocId}:en:draft`, {
          body: doc,
          qs: { aposMode: 'draft' },
          jar: jarAdmin
        });
      }

      const restoredBefore = await restore(before);
      assert.equal(restoredBefore.title, 'Before');
      assert.equal(restoredBefore.int, 1);

      const restoredAfter = await restore(after);
      assert.equal(restoredAfter.title, 'After');
      assert.equal(restoredAfter.int, 2);
    });

    it('should store a document with a large area in less room than plain', async function() {
      const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do ' +
        'eiusmod tempor incididunt ut labore et dolore magna aliqua.';
      const article = await apos.article.insert(getReq(apos), {
        title: 'Large',
        main: {
          _id: 'main',
          metaType: 'area',
          items: Array.from({ length: 200 }, (_, i) => ({
            _id: `widget${i}`,
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content: `<p>${i}: ${paragraph}</p>`
          }))
        }
      });
      const [ record ] = await apos.docVersions.find(
        apos.task.getReq(),
        apos.docVersions.getTimelineCriteria(article),
        { raw: true }
      );
      const { EJSON } = apos.modules['@apostrophecms/db'];
      const doc = await apos.docVersions.unpack(record.doc);
      const plain = Buffer.byteLength(EJSON.stringify(doc));

      assert(Buffer.byteLength(record.doc) < plain);
    });
  });

  describe('legacy module', function () {
    const legacyName = '@apostrophecms-pro/document-versions';
    let apos;

    before(async function() {
      // A stub with no methods stands in for the deprecation release
      apos = await bootstrap({
        modules: {
          article: {},
          'default-page': {},
          [legacyName]: {}
        }
      });
    });

    after(async function() {
      await destroy(apos);
    });

    it('should start next to the deprecation release, which has no methods', function () {
      assert(apos.modules[legacyName]);
      assert(apos.docVersions);
      assert.doesNotThrow(() => apos.docVersions.checkLegacyModule());
    });

    it('should reject a module that records its own versions', function () {
      const legacy = apos.modules[legacyName];
      legacy.createFor = () => {};
      try {
        assert.throws(
          () => apos.docVersions.checkLegacyModule(),
          /Remove it from the project/
        );
      } finally {
        delete legacy.createFor;
      }
    });
  });
});
