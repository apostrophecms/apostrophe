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
  seedVersionsFor
} = require('./utils/document-versions.js');
const compareSchema = require('./utils/document-versions-compare-schema.js');

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
      assert.strictEqual(versions.length, 7);
      const home = versions.filter(v => v.doc.type === '@apostrophecms/home-page');
      const global = versions.filter(v => v.doc.type === '@apostrophecms/global');
      // Parked documents are inserted as drafts and published at once, so each
      // starts with a draft version and a published one
      assert.deepStrictEqual(home.map(v => v.mode), [ 'published', 'draft' ]);
      assert.deepStrictEqual(global.map(v => v.mode), [ 'published', 'draft' ]);
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

    it('should not have versions enabled for doc types with `versions: false`', async function() {
      assert.equal(
        await apos.docVersions.canHaveVersion(getReq(apos), {
          aposMode: 'published',
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

      // Inserting in published mode writes the draft first, then publishes
      {
        const versions = await apos.docVersions.find(req, {});
        assert.strictEqual(versions.length, 2);
        const [ published, draft ] = versions;
        assert.deepStrictEqual(published.doc, article);
        assert.strictEqual(published.mode, 'published');
        assert.strictEqual(draft.mode, 'draft');
        assert.strictEqual(draft.doc._id, article._id.replace(':published', ':draft'));
      }

      const updated = await apos.article.update(req, {
        ...article,
        title: 'An article v2'
      });
      assert(updated);
      {
        const versions = await apos.docVersions.find(req, {});
        assert.strictEqual(versions.length, 3);
        const [ first, second, third ] = versions;
        assert.deepStrictEqual(first.doc, updated);
        assert.deepStrictEqual(second.doc, article);
        assert.strictEqual(third.mode, 'draft');
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
        assert.strictEqual(versions.length, 3);
        const [ first, second, draft ] = versions;

        assert.deepStrictEqual(first.doc, updated1);
        assert.deepStrictEqual(second.doc, article1);
        assert.strictEqual(draft.mode, 'draft');
      }

      {
        const versions = await apos.docVersions
          .find(req, apos.docVersions.getTimelineCriteria(article2));
        assert.strictEqual(versions.length, 3);
        const [ first, second, draft ] = versions;

        assert.deepStrictEqual(first.doc, updated2);
        assert.deepStrictEqual(second.doc, article2);
        assert.strictEqual(draft.mode, 'draft');
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
      assert.strictEqual(versions.length, 2);
      assert.deepStrictEqual(versions[0].doc, page);
      assert.strictEqual(versions[1].mode, 'draft');

      const updated = await apos.doc.update(req, {
        ...page,
        title: 'An article page v2'
      });
      assert(updated);

      versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 3);
      const [ first, second, draft ] = versions;

      assert.deepStrictEqual(first.doc, updated);
      assert.deepStrictEqual(second.doc, page);
      assert.strictEqual(draft.mode, 'draft');
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
        assert.strictEqual(versions.length, 3);
        const [ first, second, draft ] = versions;

        assert.deepStrictEqual(first.doc, updated1);
        assert.deepStrictEqual(second.doc, page1);
        assert.strictEqual(draft.mode, 'draft');
      }

      {
        const versions = await apos.docVersions
          .find(req, apos.docVersions.getTimelineCriteria(page2));
        assert.strictEqual(versions.length, 3);
        const [ first, second, draft ] = versions;

        assert.deepStrictEqual(first.doc, updated2);
        assert.deepStrictEqual(second.doc, page2);
        assert.strictEqual(draft.mode, 'draft');
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
      assert.strictEqual(versions.length, 2);
      assert.deepStrictEqual(versions[0].doc, page);
      assert.strictEqual(versions[1].mode, 'draft');

      const updated = await apos.doc.update(req, {
        ...page,
        title: 'A page v2'
      });
      assert(updated);

      versions = await apos.docVersions.find(req, {});
      assert.strictEqual(versions.length, 3);
      const [ first, second, draft ] = versions;

      assert.deepStrictEqual(first.doc, updated);
      assert.deepStrictEqual(second.doc, page);
      assert.strictEqual(draft.mode, 'draft');
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
        assert.strictEqual(versions.length, 3);
        const [ first, second, draft ] = versions;

        assert.deepStrictEqual(first.doc, updated1);
        assert.deepStrictEqual(second.doc, page1);
        assert.strictEqual(draft.mode, 'draft');
      }

      {
        const versions = await apos.docVersions
          .find(req, apos.docVersions.getTimelineCriteria(page2));
        assert.strictEqual(versions.length, 3);
        const [ first, second, draft ] = versions;

        assert.deepStrictEqual(first.doc, updated2);
        assert.deepStrictEqual(second.doc, page2);
        assert.strictEqual(draft.mode, 'draft');
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

  describe('disabled', function() {
    let apos;

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
    });

    after(async function() {
      await removeUploads();
      await destroy(apos);
    });

    beforeEach(async function() {
      await cleanup(apos);
    });

    it('should not add version docs when explicitly disabled (pieces)', async function() {
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

    it('should not add version docs when explicitly disabled (piece pages)', async function() {
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

    it('should not add version docs when explicitly disabled (pages)', async function() {
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

      // Reference of attachment1 to the draft version and version1
      const attachment1After1 = await apos.attachment.db
        .findOne({ _id: attachment1._id });
      const [ version1, draftVersion ] = await apos.docVersions.find(
        req,
        apos.docVersions.getTimelineCriteria(article),
        {
          project: { _id: 1 }
        }
      );
      assert(version1);
      assert(draftVersion);
      assert.strictEqual(attachment1After1.archivedDocIds.length, 2);
      assert(attachment1After1.archivedDocIds.includes(draftVersion._id));
      assert(attachment1After1.archivedDocIds.includes(version1._id));

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

      assert.strictEqual(attachment1After2.archivedDocIds.length, 3);
      assert(attachment1After2.archivedDocIds.includes(draftVersion._id));
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

      assert.strictEqual(attachment1After3.archivedDocIds.length, 3);
      assert(attachment1After3.archivedDocIds.includes(draftVersion._id));
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
      assert.strictEqual(articleModesCount, 3);

      // Validate references: each draft save and each publish is a version
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
            [ 'draft', 'An update' ],
            [ 'published', 'An article' ],
            [ 'draft', 'An article' ]
          ]
        );
        const [ first, second, third, fourth ] = versions;
        assert.strictEqual(first.doc.attachment, null);
        assert.strictEqual(second.doc.attachment, null);
        assert.strictEqual(third.doc.attachment._id, attachment._id);
        assert.strictEqual(fourth.doc.attachment._id, attachment._id);
        assert.deepStrictEqual(
          attachment.archivedDocIds.sort(),
          [ third._id, fourth._id ].sort()
        );
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

      assert.equal(versions.length, 2);
      assert(versions[0]._id);
      assert(versions[0].createdAt);
      assert.equal(versions[0].author, admin.title);
      assert.equal(
        Object.keys(versions[0]).length,
        Object.keys(apos.docVersions.getRestProjection()).length
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

      assert.equal(versions.length, 2);
      assert(versions[0]._id);
      assert(versions[0].createdAt);
      assert.equal(versions[0].author, editor.title);
      assert.equal(
        Object.keys(versions[0]).length,
        Object.keys(apos.docVersions.getRestProjection()).length
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
      assert.equal(versions.length, 2);
      assert(versions[0]._id);
      assert(versions[0].createdAt);
      assert.equal(
        Object.keys(versions[0]).length,
        Object.keys(apos.docVersions.getRestProjection()).length
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
      assert.equal(
        Object.keys(version).length,
        // projection plus the doc
        Object.keys(apos.docVersions.getRestProjection()).length + 1
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
      assert.equal(
        Object.keys(version).length,
        // projection plus the doc
        Object.keys(apos.docVersions.getRestProjection()).length + 1
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
      assert.equal(
        Object.keys(version).length,
        // projection plus the doc
        Object.keys(apos.docVersions.getRestProjection()).length + 1
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
  });

  describe('methods', function () {
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

    describe('getCompareSchema', function () {
      it('should merge both versions schema for pieces', async function() {
        const req = getReq(apos, {
          _id: 1,
          username: 'user'
        });

        const articleV1 = await apos.article.insert(req, { title: 'My first article' });
        const articleV2 = await apos.article.update(req, {
          ...articleV1,
          title: 'My first article v2'
        });
        const articleV3 = await apos.article.update(req, {
          ...articleV2,
          title: 'My first article v3'
        });

        const versions = await apos.docVersions
          .find(req, apos.docVersions.getTimelineCriteria(articleV3));
        const { _id: v1Id } = versions.find(version => version.doc.title === 'My first article v3');
        const { _id: v2Id } = versions.find(version => version.doc.title === 'My first article');

        const v1 = await apos.docVersions.getOne(req, v1Id);
        const v2 = await apos.docVersions.getOne(req, v2Id);
        const schema = await apos.docVersions.getCompareSchema(v1, v2);

        const actual = schema;
        const expected = compareSchema.article
          .map((field, index) => {
            return {
              ...field,
              _id: schema[index]._id,
              aposPath: schema[index].aposPath,
              ...(field.schema && {
                schema: field.schema.map((subField, subIndex) => {
                  return {
                    ...subField,
                    _id: schema[index].schema[subIndex]._id,
                    aposPath: schema[index].schema[subIndex].aposPath
                  };
                })
              })
            };
          });

        assert.deepEqual(actual, expected);
      });

      it('should merge both versions schema for pages', async function() {
        const req = getReq(apos, {
          _id: 1,
          username: 'user'
        });

        const defaultPageV1 = await apos.doc.insert(
          req,
          {
            title: 'My first page',
            type: 'default-page'
          }
        );
        const articlePageV2 = await apos.doc.update(
          req,
          {
            ...defaultPageV1,
            title: 'Articles',
            type: 'article-page'
          }
        );

        const versions = await apos.docVersions
          .find(req, apos.docVersions.getTimelineCriteria(articlePageV2));
        const { _id: v1Id } = versions.find(version => version.doc.title === 'Articles');
        const { _id: v2Id } = versions.find(version => version.doc.title === 'My first page');

        const v1 = await apos.docVersions.getOne(req, v1Id);
        const v2 = await apos.docVersions.getOne(req, v2Id);
        const schema = await apos.docVersions.getCompareSchema(v1, v2);

        const actual = schema;
        const expected = compareSchema.articlePage
          .map((field, index) => {
            return {
              ...field,
              _id: schema[index]._id,
              aposPath: schema[index].aposPath,
              ...(field.schema && {
                schema: field.schema.map((subField, subIndex) => {
                  return {
                    ...subField,
                    _id: schema[index].schema[subIndex]._id,
                    aposPath: schema[index].schema[subIndex].aposPath
                  };
                })
              })
            };
          });

        assert.deepEqual(actual, expected);
      });
    });

    describe('getCompareData', function () {
      it('should add aposMeta with diff on first document for pieces', async function() {
        const req = getReq(apos, {
          _id: 1,
          username: 'user'
        });

        const articleV1 = await apos.article.insert(req, { title: 'My first article' });
        const articleV2 = await apos.article.update(req, {
          ...articleV1,
          title: 'My first article v2'
        });
        const articleV3 = await apos.article.update(req, {
          ...articleV2,
          title: 'My first article v3'
        });

        const versions = await apos.docVersions
          .find(req, apos.docVersions.getTimelineCriteria(articleV3));
        const { _id: v1Id } = versions.find(version => version.doc.title === 'My first article v3');
        const { _id: v2Id } = versions.find(version => version.doc.title === 'My first article');

        const v1 = await apos.docVersions.getOne(req, v1Id);
        const v2 = await apos.docVersions.getOne(req, v2Id);
        const schema = await apos.docVersions.getCompareSchema(v1, v2);
        const data = apos.docVersions.getCompareData(v1, v2, schema);

        const actual = data;
        const expected = {
          version: {
            _id: data.version._id,
            author: data.version.author,
            changeCount: 1,
            createdAt: data.version.createdAt,
            doc: {
              ...{
                ...articleV3,
                array: [],
                object: {
                  key1: '',
                  key2: ''
                }
              },
              _create: true,
              _delete: true,
              _edit: true,
              _publish: true,
              _related: []
            }
          },
          document: {
            ...{
              ...articleV3,
              array: [],
              object: {
                key1: '',
                key2: ''
              }
            },
            _create: true,
            _delete: true,
            _edit: true,
            _publish: true,
            _related: [],
            aposMeta: {
              _related: {
                '@apostrophecms/schema:compare': [],
                '@apostrophecms/schema:highlight': false
              },
              archived: {
                '@apostrophecms/schema:compare': false,
                '@apostrophecms/schema:highlight': false
              },
              array: {
                '@apostrophecms/schema:compare': [],
                '@apostrophecms/schema:highlight': false
              },
              attachment: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              boolean: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              date: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              float: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              int: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              main: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              object: {
                '@apostrophecms/schema:compare': {
                  key1: '',
                  key2: ''
                },
                '@apostrophecms/schema:highlight': false
              },
              slug: {
                '@apostrophecms/schema:compare': 'my-first-article',
                '@apostrophecms/schema:highlight': false
              },
              time: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              title: {
                '@apostrophecms/schema:compare': 'My first article',
                '@apostrophecms/schema:highlight': true
              },
              visibility: {
                '@apostrophecms/schema:compare': 'public',
                '@apostrophecms/schema:highlight': false
              }
            }
          }
        };

        assert.deepEqual(actual, expected);
      });

      it('should add aposMeta with diff on first document for pages', async function() {
        const req = getReq(apos, {
          _id: 1,
          username: 'user'
        });

        const defaultPageV1 = await apos.doc.insert(
          req,
          {
            title: 'My first page',
            type: 'default-page'
          }
        );
        const articlePageV2 = await apos.doc.update(
          req,
          {
            ...defaultPageV1,
            title: 'Articles',
            slug: '/articles',
            type: 'article-page'
          }
        );

        const versions = await apos.docVersions
          .find(req, apos.docVersions.getTimelineCriteria(articlePageV2));
        const { _id: v1Id } = versions.find(version => version.doc.title === 'Articles');
        const { _id: v2Id } = versions.find(version => version.doc.title === 'My first page');

        const v1 = await apos.docVersions.getOne(req, v1Id);
        const v2 = await apos.docVersions.getOne(req, v2Id);
        const schema = await apos.docVersions.getCompareSchema(v1, v2);
        const data = apos.docVersions.getCompareData(v1, v2, schema);

        const actual = data;
        const expected = {
          version: {
            _id: data.version._id,
            author: data.version.author,
            changeCount: 3,
            createdAt: data.version.createdAt,
            doc: {
              ...{
                ...articlePageV2,
                array: [],
                object: {
                  key1: '',
                  key2: ''
                },
                orphan: false
              },
              _create: true,
              _delete: true,
              _edit: true,
              _publish: true,
              _related: [],
              _url: '/articles'
            }
          },
          document: {
            ...{
              ...articlePageV2,
              array: [],
              object: {
                key1: '',
                key2: ''
              },
              orphan: false
            },
            _create: true,
            _delete: true,
            _edit: true,
            _publish: true,
            _related: [],
            _url: '/articles',
            aposMeta: {
              _related: {
                '@apostrophecms/schema:compare': [],
                '@apostrophecms/schema:highlight': false
              },
              array: {
                '@apostrophecms/schema:compare': [],
                '@apostrophecms/schema:highlight': false
              },
              attachment: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              boolean: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              date: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              float: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              int: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              main: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              object: {
                '@apostrophecms/schema:compare': {
                  key1: '',
                  key2: ''
                },
                '@apostrophecms/schema:highlight': false
              },
              orphan: {
                '@apostrophecms/schema:compare': false,
                '@apostrophecms/schema:highlight': false
              },
              slug: {
                '@apostrophecms/schema:compare': '/my-first-page',
                '@apostrophecms/schema:highlight': true
              },
              time: {
                '@apostrophecms/schema:compare': undefined,
                '@apostrophecms/schema:highlight': false
              },
              title: {
                '@apostrophecms/schema:compare': 'My first page',
                '@apostrophecms/schema:highlight': true
              },
              type: {
                '@apostrophecms/schema:compare': 'default-page',
                '@apostrophecms/schema:highlight': true
              },
              visibility: {
                '@apostrophecms/schema:compare': 'public',
                '@apostrophecms/schema:highlight': false
              }
            }
          }
        };

        assert.deepEqual(actual, expected);
      });
    });

    describe('removeIfFrom', function () {
      it('should remove if property from fields', function () {
        const schema = {
          fields: {
            add: {
              seenMovie: {
                label: 'Have you seen this movie?',
                type: 'boolean'
              },
              rating: {
                label: 'Rate the movie from 1-5',
                type: 'integer',
                min: 1,
                max: 5,
                if: {
                  seenMovie: true
                }
              },
              selectSponsors: {
                label: 'Select a project sponsor',
                type: 'select',
                choices: 'sponsorNames',
                if: {
                  'isSponsored()': true
                }
              },
              grantName: {
                label: 'Select a grant',
                type: 'select',
                choices: 'grantNames',
                if: {
                  'grant:multipleFundingSources()': 'multiple'
                }
              },
              address: {
                label: 'Address',
                type: 'object',
                fields: {
                  add: {
                    street: {
                      type: 'string',
                      label: 'Street'
                    },
                    city: {
                      type: 'string',
                      label: 'City',
                      if: {
                        'complexCondition()': 'true'
                      }
                    },
                    state: {
                      type: 'string',
                      label: 'State'
                    }
                  }
                }
              },
              contactInfo: {
                label: 'Contact information',
                type: 'array',
                titleField: 'city',
                fields: {
                  add: {
                    city: {
                      type: 'string',
                      label: 'City'
                    },
                    email: {
                      type: 'email',
                      label: 'Email address',
                      if: {
                        'complexCondition()': 'true'
                      }
                    }
                  }
                }
              }
            }
          }
        };

        const actual = Object.fromEntries(Object.entries(schema.fields.add)
          .map(([ name, field ]) => [
            name,
            apos.docVersions.removeIfFrom(field)
          ])
        );
        const expected = {
          seenMovie: {
            label: 'Have you seen this movie?',
            type: 'boolean'
          },
          rating: {
            label: 'Rate the movie from 1-5',
            type: 'integer',
            min: 1,
            max: 5
          },
          selectSponsors: {
            label: 'Select a project sponsor',
            type: 'select',
            choices: 'sponsorNames'
          },
          grantName: {
            label: 'Select a grant',
            type: 'select',
            choices: 'grantNames'
          },
          address: {
            label: 'Address',
            type: 'object',
            fields: {
              add: {
                street: {
                  type: 'string',
                  label: 'Street'
                },
                city: {
                  type: 'string',
                  label: 'City'
                },
                state: {
                  type: 'string',
                  label: 'State'
                }
              }
            }
          },
          contactInfo: {
            label: 'Contact information',
            type: 'array',
            titleField: 'city',
            fields: {
              add: {
                city: {
                  type: 'string',
                  label: 'City'
                },
                email: {
                  type: 'email',
                  label: 'Email address'
                }
              }
            }
          }
        };

        assert.deepEqual(actual, expected);
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

    // One document with a draft and three published versions in `en`, a
    // draft and two published versions in `fr`. Returns the counts recorded
    // at save time, newest first per locale.
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
        en: [ 2, 1, 0, 0 ],
        fr: [ 1, 0, 0 ]
      });

      await apos.docVersions.db.updateMany({}, { $set: { changeCount: 99 } });
      await apos.docVersions.setChangeCountTask();

      // The oldest version of a timeline has no predecessor and is left alone
      assert.deepEqual(await countsFor(article), {
        en: [ 2, 1, 0, 99 ],
        fr: [ 1, 0, 99 ]
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
        en: [ 99, 99, 99, 99 ],
        fr: [ 1, 0, 99 ]
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
          [ article.aposDocId, 'draft', 'en' ],
          [ article.aposDocId, 'draft', 'fr' ],
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
      assert.equal(expected.length, 3);
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
      assert.deepEqual(await authorIds(byAdmin), [ admin._id, admin._id ]);
      assert.deepEqual(await authorIds(bySystem), [ null, null ]);
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
