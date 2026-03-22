const assert = require('assert').strict;
const t = require('../test-lib/test.js');

describe('Recently Edited', function () {
  let apos;
  let jar;

  this.timeout(t.timeout);

  const baseUrl = 'http://localhost:3000';

  before(async function () {
    apos = await t.create({
      root: module,
      baseUrl,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {
                label: 'English'
              },
              fr: {
                label: 'French',
                prefix: '/fr'
              },
              de: {
                label: 'German',
                prefix: '/de'
              }
            }
          }
        },
        '@apostrophecms/express': {
          options: {
            session: { secret: 'test' }
          }
        },
        '@apostrophecms/recently-edited': {
          options: {
            excludeTypes: [ 'excluded-article' ]
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'article',
            label: 'Article',
            pluralLabel: 'Articles'
          },
          fields: {
            add: {
              blurb: {
                type: 'string',
                label: 'Blurb'
              }
            }
          }
        },
        topic: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'topic',
            label: 'Topic',
            pluralLabel: 'Topics'
          },
          fields: {
            add: {
              description: {
                type: 'string',
                label: 'Description'
              }
            }
          }
        },
        'excluded-article': {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'excludedArticle',
            label: 'Excluded Article',
            pluralLabel: 'Excluded Articles'
          }
        },
        'non-localized': {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'nonLocalized',
            label: 'Non-Localized',
            localized: false
          }
        },
        'default-page': {
          extend: '@apostrophecms/page-type',
          options: {
            label: 'Default Page'
          }
        },
        '@apostrophecms/page': {
          options: {
            types: [
              {
                name: 'default-page',
                label: 'Default Page'
              },
              {
                name: '@apostrophecms/home-page',
                label: 'Home'
              }
            ]
          }
        }
      }
    });
    await t.createAdmin(apos);
    jar = await t.loginAs(apos, 'admin');
  });

  after(async function () {
    return t.destroy(apos);
  });

  // Helpers
  const recentApi = () => '/api/v1/@apostrophecms/recently-edited';

  async function cleanDocs() {
    const protectedTypes = [
      '@apostrophecms/user',
      '@apostrophecms/home-page',
      '@apostrophecms/archive-page',
      '@apostrophecms/global'
    ];
    await apos.doc.db.deleteMany({
      type: { $nin: protectedTypes }
    });
  }

  async function insertPiece(type, data, options = {}) {
    const manager = apos.modules[type];
    const reqOptions = { mode: 'draft' };
    if (options.locale) {
      reqOptions.locale = options.locale;
    }
    const req = apos.task.getReq(reqOptions);
    const instance = manager.newInstance();
    const piece = await manager.insert(req, {
      ...instance,
      ...data
    });
    return piece;
  }

  async function insertPage(data, options = {}) {
    const reqOptions = { mode: 'draft' };
    if (options.locale) {
      reqOptions.locale = options.locale;
    }
    const req = apos.task.getReq(reqOptions);
    const home = await apos.page.find(req, { slug: '/' }).toObject();
    const page = await apos.page.insert(req, home._id, 'lastChild', {
      title: data.title || 'Test Page',
      type: data.type || 'default-page',
      ...data
    });
    return page;
  }

  // ───── Module Bootstrap ─────

  describe('module initialization', function () {
    it('is registered with the recently-edited alias', function () {
      assert(apos.recentlyEdited);
    });

    it('extends @apostrophecms/piece-type', function () {
      assert(
        apos.modules['@apostrophecms/recently-edited'].__meta.chain
          .some(entry => entry.name === '@apostrophecms/piece-type')
      );
    });

    it('detects managed types (localized piece and page types)', function () {
      const names = apos.recentlyEdited.managedTypeNames;
      assert(names.includes('article'));
      assert(names.includes('topic'));
      assert(names.includes('default-page'));
      assert(names.includes('@apostrophecms/home-page'));
    });

    it('excludes types from the internal blacklist', function () {
      const names = apos.recentlyEdited.managedTypeNames;
      assert(!names.includes('@apostrophecms/recently-edited'));
      assert(!names.includes('@apostrophecms/submitted-draft'));
      assert(!names.includes('@apostrophecms/archive-page'));
    });

    it('excludes developer-configured excludeTypes', function () {
      const names = apos.recentlyEdited.managedTypeNames;
      assert(!names.includes('excluded-article'));
    });

    it('excludes non-localized types', function () {
      const names = apos.recentlyEdited.managedTypeNames;
      assert(!names.includes('non-localized'));
    });

    it('excludes abstract base types', function () {
      const names = apos.recentlyEdited.managedTypeNames;
      assert(!names.includes('@apostrophecms/any-doc-type'));
      assert(!names.includes('@apostrophecms/any-page-type'));
      assert(!names.includes('@apostrophecms/polymorphic-type'));
    });

    it('separates page type names from piece type names', function () {
      assert(apos.recentlyEdited.managedPageTypeNames.includes('default-page'));
      assert(apos.recentlyEdited.managedPageTypeNames.includes('@apostrophecms/home-page'));
      assert(!apos.recentlyEdited.managedPageTypeNames.includes('article'));

      assert(apos.recentlyEdited.managedPieceTypeNames.includes('article'));
      assert(apos.recentlyEdited.managedPieceTypeNames.includes('topic'));
      assert(!apos.recentlyEdited.managedPieceTypeNames.includes('default-page'));
    });

    it('stores managed types with label info', function () {
      const articleType = apos.recentlyEdited.managedTypes
        .find(t => t.name === 'article');
      assert(articleType);
      assert.equal(articleType.label, 'Article');
      assert.equal(articleType.pluralLabel, 'Articles');
    });

    it('creates the compound index for recently edited lookup', async function () {
      const indexes = await apos.doc.db.indexes();
      const idx = indexes.find(i => i.name === 'recentlyEditedLookup');
      assert(idx);
      assert.deepEqual(idx.key, {
        updatedAt: -1,
        _id: 1,
        type: 1,
        aposLocale: 1
      });
    });
  });

  // ───── Filter Choice Registry ─────

  describe('filter choice registry', function () {
    it('has built-in action choices', function () {
      const reg = apos.recentlyEdited.filterChoiceRegistry.action;
      assert(reg.created);
      assert(reg.published);
      assert(reg.submitted);
      assert(reg.localized);
    });

    it('has built-in status choices', function () {
      const reg = apos.recentlyEdited.filterChoiceRegistry.status;
      assert(reg.live);
      assert(reg.draft);
      assert(reg.modified);
      assert(reg.submitted);
      assert(reg.archived);
    });

    it('addFilterChoice registers a new action choice', function () {
      apos.recentlyEdited.addFilterChoice({
        type: 'action',
        name: 'imported',
        label: 'Imported',
        query(qb) {
          qb.and({ importedAt: { $exists: true } });
        }
      });
      assert(apos.recentlyEdited.filterChoiceRegistry.action.imported);
      assert.equal(
        apos.recentlyEdited.filterChoiceRegistry.action.imported.label,
        'Imported'
      );
      // Clean up
      delete apos.recentlyEdited.filterChoiceRegistry.action.imported;
    });

    it('addFilterChoice registers a new status choice', function () {
      apos.recentlyEdited.addFilterChoice({
        type: 'status',
        name: 'reviewed',
        label: 'Reviewed',
        query(qb) {
          qb.and({ reviewed: true });
        }
      });
      assert(apos.recentlyEdited.filterChoiceRegistry.status.reviewed);
      // Clean up
      delete apos.recentlyEdited.filterChoiceRegistry.status.reviewed;
    });

    it('addFilterChoice throws for invalid type', function () {
      assert.throws(() => {
        apos.recentlyEdited.addFilterChoice({
          type: 'bogus',
          name: 'x',
          label: 'X',
          query() {}
        });
      }, /type must be "action" or "status"/);
    });
  });

  // ───── Virtual Type Behavior ─────

  describe('virtual type behavior', function () {
    before(async function () {
      await cleanDocs();
    });

    it('throws on insert (virtual type should never insert)', async function () {
      await assert.rejects(async () => {
        await apos.recentlyEdited.insert(
          apos.task.getReq(),
          { title: 'test' }
        );
      }, /Virtual piece type/);
    });

    it('delegates update to the actual type manager', async function () {
      const article = await insertPiece('article', { title: 'Delegate Update Test' });
      const updated = await apos.recentlyEdited.update(
        apos.task.getReq(),
        {
          ...article,
          title: 'Updated via delegate'
        }
      );
      assert.equal(updated.title, 'Updated via delegate');
    });

    it('delegates publish to the actual type manager', async function () {
      const article = await insertPiece('article', { title: 'Delegate Publish Test' });
      const published = await apos.recentlyEdited.publish(
        apos.task.getReq(),
        article
      );
      assert(published);
      // publish() returns the published version of the doc
      // Verify the published doc exists in the DB
      const publishedDoc = await apos.doc.db.findOne({
        aposDocId: article.aposDocId,
        aposLocale: 'en:published'
      });
      assert(publishedDoc);
    });
  });

  // ───── getCutoffDate ─────

  describe('getCutoffDate', function () {
    it('returns a date in the past based on recentDays option', function () {
      const cutoff = apos.recentlyEdited.getCutoffDate();
      assert(cutoff instanceof Date);
      const now = new Date();
      const diffDays = (now - cutoff) / (1000 * 60 * 60 * 24);
      // recentDays is 30
      assert(diffDays >= 29 && diffDays <= 31);
    });
  });

  // ───── find() Query Builder ─────

  describe('find() base query', function () {
    before(async function () {
      await cleanDocs();
      for (let i = 0; i < 3; i++) {
        await insertPiece('article', {
          title: `Find Article ${i}`
        });
      }
      // Insert a topic in a different locale
      await insertPiece('topic', {
        title: 'French Topic'
      }, { locale: 'fr' });

      // Insert an excluded type
      const excludedManager = apos.modules['excluded-article'];
      const req = apos.task.getReq({ mode: 'draft' });
      await excludedManager.insert(req, {
        ...excludedManager.newInstance(),
        title: 'Should Not Appear'
      });
    });

    it('returns draft documents across types and locales', async function () {
      const req = apos.task.getReq({ mode: 'draft' });
      const results = await apos.recentlyEdited
        .find(req)
        .toArray();
      // Articles + topic + home pages (from parked pages in all 3 locales)
      // + any other parked pages but NOT excluded-article
      assert(results.length > 0);
      const types = [ ...new Set(results.map(r => r.type)) ];
      assert(!types.includes('excluded-article'));
      assert(!types.includes('non-localized'));
    });

    it('only returns drafts (aposMode: draft)', async function () {
      const req = apos.task.getReq({ mode: 'draft' });
      const results = await apos.recentlyEdited
        .find(req)
        .toArray();
      for (const doc of results) {
        assert(doc.aposLocale.endsWith(':draft'), `Expected draft, got ${doc.aposLocale}`);
      }
    });

    it('returns docs from all locales (locale null)', async function () {
      const req = apos.task.getReq({
        mode: 'draft',
        locale: 'en'
      });
      const results = await apos.recentlyEdited
        .find(req)
        .toArray();
      const locales = [ ...new Set(results.map(r => r.aposLocale.split(':')[0])) ];
      assert(locales.includes('en'));
      assert(locales.includes('fr'));
    });

    it('sorts by updatedAt descending with _id tiebreaker', async function () {
      const req = apos.task.getReq({ mode: 'draft' });
      const results = await apos.recentlyEdited
        .find(req)
        .toArray();
      for (let i = 1; i < results.length; i++) {
        const prevDate = new Date(results[i - 1].updatedAt).getTime();
        const currDate = new Date(results[i].updatedAt).getTime();
        if (prevDate === currDate) {
          assert(
            results[i - 1]._id < results[i]._id,
            'Docs with same updatedAt should be sorted by _id ascending'
          );
        } else {
          assert(
            prevDate > currDate,
            'Results should be sorted by updatedAt descending'
          );
        }
      }
    });

    it('respects the rolling time window (updatedAt >= cutoff)', async function () {
      const cutoff = apos.recentlyEdited.getCutoffDate();
      const req = apos.task.getReq({ mode: 'draft' });
      const results = await apos.recentlyEdited
        .find(req)
        .toArray();
      for (const doc of results) {
        assert(
          new Date(doc.updatedAt) >= cutoff,
          `Document ${doc.title} updatedAt ${doc.updatedAt} should be >= cutoff ${cutoff}`
        );
      }
    });

    it('does not include relationships or areas', async function () {
      const req = apos.task.getReq({ mode: 'draft' });
      const query = apos.recentlyEdited.find(req);
      assert.equal(query.get('relationships'), false);
      assert.equal(query.get('areas'), false);
      assert.equal(query.get('attachments'), false);
    });
  });

  // ───── REST API Endpoint ─────

  describe('REST API GET (getAll)', function () {
    before(async function () {
      await cleanDocs();
      for (let i = 1; i <= 5; i++) {
        await insertPiece('article', { title: `REST Article ${i}` });
      }
      for (let i = 1; i <= 3; i++) {
        await insertPiece('topic', { title: `REST Topic ${i}` });
      }
    });

    it('returns results for authenticated users', async function () {
      const response = await apos.http.get(recentApi(), { jar });
      assert(response.results);
      assert(response.results.length > 0);
    });

    it('returns paginated results', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: {
            perPage: 3,
            page: 1
          }
        }
      );
      assert(response.results.length <= 3);
      assert(response.pages >= 1);
      assert.equal(response.currentPage, 1);
    });

    it('applies the manager API projection by default', async function () {
      const response = await apos.http.get(recentApi(), { jar });
      const doc = response.results[0];
      assert(doc.title !== undefined);
      assert(doc.type !== undefined);
      assert(doc.slug !== undefined);
      assert(doc.updatedAt !== undefined);
      assert(doc.aposLocale !== undefined);
      assert(doc.aposMode !== undefined);
      assert(doc.aposDocId !== undefined);
      assert(doc._id !== undefined);
      assert(doc.updatedBy !== undefined || doc.updatedBy === null);
      assert(doc.archived !== undefined);
      assert(doc.modified !== undefined);
      // Virtual permission flags
      assert.equal(doc._edit, true);
      assert.equal(doc._publish, true);
      assert.equal(doc._delete, true);
    });

    it('does ensure projection does not leak schema-heavy fields', async function () {
      const article = await insertPiece('article', {
        title: 'Projection Leak Test',
        blurb: 'should not be in projection'
      });
      const response = await apos.http.get(recentApi(), { jar });
      const doc = response.results.find(r => r._id === article._id);
      assert(doc);
      assert.equal(doc.blurb, undefined);
    });

    it('allows client-provided projection to override (e.g. _id only for select-all)', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { 'project[_id]': 1 }
        }
      );
      const doc = response.results[0];
      assert(doc._id);
      assert.equal(doc.blurb, undefined);
    });

    it('lean mode disables addUrls computation', async function () {
      const page = await insertPage({ title: 'Lean URL Test' });

      const normal = await apos.http.get(
        recentApi(), {
          jar,
          qs: { _docType: [ 'default-page' ] }
        }
      );
      const withUrl = normal.results.find(r => r._id === page._id);
      assert(withUrl);
      assert(withUrl._url);

      // Pages store _url in MongoDB, so it persists even in lean mode.
      // Lean skips addUrls post-processing (cross-locale resolution overhead).
      const lean = await apos.http.get(
        recentApi(), {
          jar,
          qs: {
            lean: 1,
            _docType: [ 'default-page' ]
          }
        }
      );
      const leanPage = lean.results.find(r => r._id === page._id);
      assert(leanPage);
      assert(leanPage._url);
    });

    it('includes parked field in projection for pages', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { _docType: [ '@apostrophecms/home-page' ] }
        }
      );
      const home = response.results.find(
        r => r.type === '@apostrophecms/home-page'
      );
      assert(home);
      assert(home.parked !== undefined);
    });
  });

  // ───── Query Builders (Filters) ─────

  describe('query builders', function () {
    // Known data setup:
    // - 3 admin articles (en) via REST (updatedBy = admin)
    // - 2 editor articles (en) via DB stamp (updatedBy = editor)
    // - 1 admin topic (en) via REST
    // - 1 french article (fr) via server-side insert
    // - 6 parked managed docs (3 home-page + 3 global, all with lastPublishedAt)
    // Total user-created: 7 docs, parked: 6 = 13 draft docs
    let adminUser;
    let editorUserId;

    before(async function () {
      await cleanDocs();

      adminUser = await apos.doc.db.findOne({
        type: '@apostrophecms/user',
        username: 'admin'
      });

      editorUserId = 'simulated-editor-user-id';
      const editorUpdatedBy = {
        _id: editorUserId,
        title: 'qb-editor',
        username: 'qb-editor'
      };

      for (let i = 1; i <= 3; i++) {
        await apos.http.post('/api/v1/article', {
          jar,
          body: {
            title: `Admin Article ${i}`,
            blurb: `admin article ${i}`
          }
        });
      }

      for (let i = 1; i <= 2; i++) {
        const piece = await insertPiece('article', {
          title: `Editor Article ${i}`
        });
        await apos.doc.db.updateOne(
          { _id: piece._id },
          { $set: { updatedBy: editorUpdatedBy } }
        );
      }

      await apos.http.post('/api/v1/topic', {
        jar,
        body: { title: 'Admin Topic 1' }
      });

      const frReq = apos.task.getReq({
        mode: 'draft',
        locale: 'fr'
      });
      const frManager = apos.modules.article;
      await frManager.insert(frReq, {
        ...frManager.newInstance(),
        title: 'French Article'
      });
    });

    // ── _docType filter ──

    describe('_docType filter', function () {
      it('filters by a specific document type', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _docType: [ 'article' ] }
          }
        );
        // 3 admin + 2 editor + 1 french = 6 articles
        assert.equal(response.results.length, 6);
        for (const doc of response.results) {
          assert.equal(doc.type, 'article');
        }
      });

      it('filters by multiple types', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _docType: [ 'article', 'topic' ] }
          }
        );
        // 6 articles + 1 topic = 7
        assert.equal(response.results.length, 7);
        const types = [ ...new Set(response.results.map(r => r.type)) ];
        assert.deepEqual(types.sort(), [ 'article', 'topic' ]);
      });

      it('filters by virtual group @apostrophecms/any-page-type', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _docType: [ '@apostrophecms/any-page-type' ] }
          }
        );
        // 3 home pages (en, fr, de)
        assert.equal(response.results.length, 3);
        for (const doc of response.results) {
          assert(
            apos.recentlyEdited.managedPageTypeNames.includes(doc.type),
            `${doc.type} should be a page type`
          );
        }
      });

      it('filters by virtual group @apostrophecms/piece-type', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _docType: [ '@apostrophecms/piece-type' ] }
          }
        );
        // 6 articles + 1 topic + 3 globals = 10
        assert.equal(response.results.length, 10);
        for (const doc of response.results) {
          assert(
            apos.recentlyEdited.managedPieceTypeNames.includes(doc.type),
            `${doc.type} should be a piece type`
          );
        }
      });

      it('launders invalid types — returns all results', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _docType: [ 'bogus-type' ] }
          }
        );
        // Invalid filter launders to empty array, no narrowing applied
        assert.equal(response.results.length, 13);
      });
    });

    // ── _editedBy filter ──

    describe('_editedBy filter', function () {
      it('returns only admin-edited docs', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _editedBy: adminUser._id }
          }
        );
        // 3 admin articles + 1 admin topic = 4
        // (home pages + french article lack admin updatedBy stamp)
        assert.equal(response.results.length, 4);
        for (const doc of response.results) {
          assert.equal(doc.updatedBy?._id, adminUser._id);
        }
      });

      it('returns only editor-edited docs', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _editedBy: editorUserId }
          }
        );
        // 2 editor articles
        assert.equal(response.results.length, 2);
        for (const doc of response.results) {
          assert.equal(doc.updatedBy?._id, editorUserId);
        }
      });
    });

    // ── _locale filter ──

    describe('_locale filter', function () {
      it('returns only English locale docs', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _locale: 'en' }
          }
        );
        // 3 admin articles + 2 editor articles + 1 topic + 1 en home + 1 en
        // global = 8
        assert.equal(response.results.length, 8);
        for (const doc of response.results) {
          assert(doc.aposLocale.startsWith('en:'));
        }
      });

      it('returns only French locale docs', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _locale: 'fr' }
          }
        );
        // 1 french article + 1 fr home + 1 fr global = 3
        assert.equal(response.results.length, 3);
        for (const doc of response.results) {
          assert(doc.aposLocale.startsWith('fr:'));
        }
      });

      it('returns all 3 configured locales when no filter', async function () {
        const response = await apos.http.get(recentApi(), { jar });
        const locales = [ ...new Set(
          response.results.map(r => r.aposLocale.split(':')[0])
        ) ];
        assert.deepEqual(locales.sort(), [ 'de', 'en', 'fr' ]);
      });
    });

    // ── _action filter ──

    describe('_action filter', function () {
      it('filters by "created" action', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _action: 'created' }
          }
        );
        // All test docs were created within recentDays window
        assert.equal(response.results.length, 13);
      });

      it('filters by "published" action', async function () {
        const piece = await insertPiece('article', { title: 'Action Published Test' });
        const req = apos.task.getReq({ mode: 'draft' });
        await apos.modules.article.publish(req, piece);

        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _action: 'published' }
          }
        );
        assert(response.results.length > 0);
        for (const doc of response.results) {
          assert(doc.lastPublishedAt, 'published docs should have lastPublishedAt');
        }
      });

      it('launders unknown action — no filter applied, returns all', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _action: 'nonexistent' }
          }
        );
        // unknown action launders to null, no narrowing
        assert(response.results.length >= 10);
      });
    });

    // ── _status filter ──

    describe('_status filter', function () {
      before(async function () {
        await cleanDocs();

        // 2 published articles
        for (let i = 1; i <= 2; i++) {
          const piece = await insertPiece('article', { title: `Published Article ${i}` });
          const req = apos.task.getReq({ mode: 'draft' });
          await apos.modules.article.publish(req, piece);
        }
        // 3 draft-only articles
        for (let i = 1; i <= 3; i++) {
          await insertPiece('article', { title: `Draft Article ${i}` });
        }
        // 1 archived article
        const archived = await insertPiece('article', { title: 'Archived Article' });
        await apos.doc.db.updateOne(
          { _id: archived._id },
          { $set: { archived: true } }
        );
      });

      it('filters by "live" status (has lastPublishedAt)', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _status: 'live' }
          }
        );
        // 2 published articles + 6 parked (3 home + 3 global,
        // all have lastPublishedAt) = 8
        assert.equal(response.results.length, 8);
        for (const doc of response.results) {
          assert(doc.lastPublishedAt, 'live docs should have lastPublishedAt');
        }
      });

      it('filters by "draft" status (no lastPublishedAt)', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _status: 'draft' }
          }
        );
        for (const doc of response.results) {
          assert(!doc.lastPublishedAt, 'draft-only docs should lack lastPublishedAt');
        }
        // 3 draft-only articles (no lastPublishedAt)
        // archived article excluded by default archived builder
        assert.equal(response.results.length, 3);
      });

      it('filters by "archived" status', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _status: 'archived' }
          }
        );
        assert.equal(response.results.length, 1);
        assert.equal(response.results[0].title, 'Archived Article');
        assert.equal(response.results[0].archived, true);
      });

      it('launders unknown status — no filter applied, returns all', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { _status: 'nonexistent' }
          }
        );
        // 2 published + 3 draft + 6 parked = 11
        // (archived article excluded by default archived builder)
        assert.equal(response.results.length, 11);
      });
    });

    // ── Search ──

    describe('search filter', function () {
      before(async function () {
        await cleanDocs();
        await insertPiece('article', { title: 'Searchable French Pastry' });
        await insertPiece('article', { title: 'English Breakfast' });
        await insertPiece('topic', { title: 'French Cuisine' });
      });

      it('filters results by search text', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { autocomplete: 'French' }
          }
        );
        assert.equal(response.results.length, 2);
        const titles = response.results.map(r => r.title).sort();
        assert.deepEqual(titles, [ 'French Cuisine', 'Searchable French Pastry' ]);
      });

      it('returns empty results for non-matching search', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: { autocomplete: 'zzzznonexistent99999' }
          }
        );
        assert.equal(response.results.length, 0);
      });
    });
  });

  // ───── Filter Choices ─────

  describe('filter choices', function () {
    // Known data:
    // - 3 admin articles (en) via REST (updatedBy = admin)
    // - 1 editor topic (en) via DB stamp (updatedBy = editor)
    // - 1 french article (fr) via server-side insert
    // - 6 parked managed docs (3 home-page + 3 global)
    // Total: 5 user-created + 6 parked = 11 draft docs
    // Distinct types: article, topic, @apostrophecms/home-page, @apostrophecms/global
    let adminUser;
    let editorUserId;

    before(async function () {
      await cleanDocs();

      editorUserId = 'simulated-choice-editor-id';
      const editorUpdatedBy = {
        _id: editorUserId,
        title: 'choice-editor',
        username: 'choice-editor'
      };

      adminUser = await apos.doc.db.findOne({
        type: '@apostrophecms/user',
        username: 'admin'
      });

      for (let i = 1; i <= 3; i++) {
        await apos.http.post('/api/v1/article', {
          jar,
          body: { title: `Choice Article ${i}` }
        });
      }

      const topic = await insertPiece('topic', { title: 'Choice Topic Editor' });
      await apos.doc.db.updateOne(
        { _id: topic._id },
        { $set: { updatedBy: editorUpdatedBy } }
      );

      const frReq = apos.task.getReq({
        mode: 'draft',
        locale: 'fr'
      });
      const articleMgr = apos.modules.article;
      await articleMgr.insert(frReq, {
        ...articleMgr.newInstance(),
        title: 'French Choice Art'
      });
    });

    it('returns _docType choices matching distinct types in data', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { choices: '_docType' }
        }
      );
      const values = response.choices._docType.map(c => c.value).sort();
      // 4 concrete types + 1 virtual group (@apostrophecms/piece-type)
      // @apostrophecms/piece-type appears because multiple piece types
      // (article, topic, global) have data
      // No @apostrophecms/any-page-type because only 1 page type (home-page) has data
      assert.deepEqual(values, [
        '@apostrophecms/global',
        '@apostrophecms/home-page',
        '@apostrophecms/piece-type',
        'article',
        'topic'
      ]);
      // Each concrete choice must have a label
      const articleChoice = response.choices._docType.find(c => c.value === 'article');
      assert.equal(articleChoice.label, 'Article');
      const topicChoice = response.choices._docType.find(c => c.value === 'topic');
      assert.equal(topicChoice.label, 'Topic');
    });

    it('returns _editedBy choices for all editors in data', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { choices: '_editedBy' }
        }
      );
      // admin created 3 articles, editor created 1 topic
      // home pages and french article lack REST-stamped updatedBy
      const choiceValues = response.choices._editedBy.map(c => c.value).sort();
      assert(choiceValues.includes(adminUser._id));
      assert(choiceValues.includes(editorUserId));
      // Verify labels
      const adminChoice = response.choices._editedBy.find(c => c.value === adminUser._id);
      assert(adminChoice.label);
      const editorChoice = response.choices._editedBy.find(c => c.value === editorUserId);
      assert.equal(editorChoice.label, 'choice-editor');
    });

    it('returns _locale choices for all 3 configured locales', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { choices: '_locale' }
        }
      );
      const values = response.choices._locale.map(c => c.value).sort();
      assert.deepEqual(values, [ 'de', 'en', 'fr' ]);
      // Labels include locale name
      const enChoice = response.choices._locale.find(c => c.value === 'en');
      assert(enChoice.label.includes('English'));
      const frChoice = response.choices._locale.find(c => c.value === 'fr');
      assert(frChoice.label.includes('French'));
    });

    it('returns _action choices — full registry (4 static entries)', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { choices: '_action' }
        }
      );
      const values = response.choices._action.map(c => c.value).sort();
      assert.deepEqual(values, [ 'created', 'localized', 'published', 'submitted' ]);
      // Each has a label
      for (const choice of response.choices._action) {
        assert(choice.label, `_action choice "${choice.value}" must have a label`);
      }
    });

    it('returns _status choices — full registry (5 static entries)', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { choices: '_status' }
        }
      );
      const values = response.choices._status.map(c => c.value).sort();
      assert.deepEqual(values, [ 'archived', 'draft', 'live', 'modified', 'submitted' ]);
      for (const choice of response.choices._status) {
        assert(choice.label, `_status choice "${choice.value}" must have a label`);
      }
    });

    it('returns all 5 choice types in a single request', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { choices: '_docType,_editedBy,_locale,_action,_status' }
        }
      );
      assert.equal(response.choices._docType.length, 5);
      assert(response.choices._editedBy.length >= 2);
      assert.equal(response.choices._locale.length, 3);
      assert.equal(response.choices._action.length, 4);
      assert.equal(response.choices._status.length, 5);
    });

    it('returns only requested choice types — omitted ones are absent', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { choices: '_editedBy,_action' }
        }
      );
      assert(response.choices._editedBy);
      assert(response.choices._action);
      assert.equal(response.choices._docType, undefined);
      assert.equal(response.choices._locale, undefined);
      assert.equal(response.choices._status, undefined);
    });

    it('cross-filtering: _docType narrows _editedBy choices', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: {
            _docType: [ 'topic' ],
            choices: '_editedBy'
          }
        }
      );
      // Only the editor created the topic
      assert.equal(response.choices._editedBy.length, 1);
      assert.equal(response.choices._editedBy[0].value, editorUserId);
    });

    it('cross-filtering: _locale narrows _docType choices', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: {
            _locale: 'fr',
            choices: '_docType'
          }
        }
      );
      // French locale has: 1 french article + 1 fr home page + 1 fr global
      // = 3 concrete types + @apostrophecms/piece-type virtual (2+ pieces)
      const values = response.choices._docType.map(c => c.value).sort();
      assert.deepEqual(values, [
        '@apostrophecms/global',
        '@apostrophecms/home-page',
        '@apostrophecms/piece-type',
        'article'
      ]);
    });

    it('ignores bogus filter names in choices param', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { choices: '_docType,bogusFilter,_action' }
        }
      );
      assert(response.choices._docType);
      assert(response.choices._action);
      assert.equal(response.choices.bogusFilter, undefined);
    });
  });

  // ───── Cross-Locale URL Resolution ─────

  describe('cross-locale URL resolution', function () {
    // Known data:
    // - 1 English default-page, 1 French default-page
    // - 3 home pages (en, fr, de) from parked pages
    // Total: 2 default-pages + 3 home pages = 5

    before(async function () {
      await cleanDocs();

      await insertPage({
        title: 'English Test Page',
        type: 'default-page'
      });

      await insertPage(
        {
          title: 'French Test Page',
          type: 'default-page'
        },
        { locale: 'fr' }
      );
    });

    it('generates correct _url for pages in their native locale', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { _docType: [ 'default-page' ] }
        }
      );
      // 1 en default-page + 1 fr default-page = 2
      assert.equal(response.results.length, 2);

      const enPage = response.results.find(
        p => p.aposLocale.startsWith('en:')
      );
      const frPage = response.results.find(
        p => p.aposLocale.startsWith('fr:')
      );

      assert(enPage, 'English page must exist');
      assert(frPage, 'French page must exist');

      assert(
        !enPage._url.includes('/fr/'),
        `English page URL should not have /fr prefix: ${enPage._url}`
      );
      assert(
        frPage._url.includes('/fr'),
        `French page URL should have /fr prefix: ${frPage._url}`
      );
    });

    it('home pages get correct locale-prefixed URLs', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { _docType: [ '@apostrophecms/home-page' ] }
        }
      );
      // 3 home pages: en, fr, de
      assert.equal(response.results.length, 3);

      const frHome = response.results.find(h => h.aposLocale.startsWith('fr:'));
      assert(frHome, 'French home page must exist');
      assert(
        frHome._url.includes('/fr'),
        `French home page URL should contain /fr, got ${frHome._url}`
      );

      const enHome = response.results.find(h => h.aposLocale.startsWith('en:'));
      assert(enHome, 'English home page must exist');
      assert(
        !enHome._url.includes('/fr') && !enHome._url.includes('/de'),
        `English home page URL should not contain locale prefix, got ${enHome._url}`
      );

      const deHome = response.results.find(h => h.aposLocale.startsWith('de:'));
      assert(deHome, 'German home page must exist');
      assert(
        deHome._url.includes('/de'),
        `German home page URL should contain /de, got ${deHome._url}`
      );
    });

    it('annotates _url with correct locale prefix in unfiltered cross-locale response', async function () {
      const response = await apos.http.get(
        recentApi(), { jar }
      );
      // Without any locale or type filter, results span all locales.
      // Every page-type result (pages store _url in DB) should carry
      // the correct locale prefix: none for en, /fr for fr, /de for de.
      const pages = response.results.filter(doc => doc._url);
      assert(
        pages.length >= 5,
        `Expected at least 5 docs with _url (2 default-page + 3 home), got ${pages.length}`
      );

      for (const doc of pages) {
        if (doc.aposLocale.startsWith('en:')) {
          assert(
            !doc._url.includes('/fr/') && !doc._url.includes('/de/'),
            `English doc "${doc.title}" should have no locale prefix, got ${doc._url}`
          );
        } else if (doc.aposLocale.startsWith('fr:')) {
          assert(
            doc._url.includes('/fr/') || doc._url.endsWith('/fr'),
            `French doc "${doc.title}" should contain /fr, got ${doc._url}`
          );
        } else if (doc.aposLocale.startsWith('de:')) {
          assert(
            doc._url.includes('/de/') || doc._url.endsWith('/de'),
            `German doc "${doc.title}" should contain /de, got ${doc._url}`
          );
        }
      }
    });
  });

  // ───── localizedAt timestamp ─────

  describe('localizedAt timestamp (core doc-type change)', function () {
    // Known data:
    // - 1 article created in en, then localized to fr
    // - 3 home pages (en, fr, de)
    // The fr-localized article has localizedAt set
    let localizedDoc;

    before(async function () {
      await cleanDocs();

      const article = await insertPiece('article', {
        title: 'Localize Timestamp Test'
      });

      const req = apos.task.getReq({
        mode: 'draft',
        locale: 'en'
      });
      const manager = apos.modules.article;
      const draft = await manager.find(req, { _id: article._id }).toObject();
      localizedDoc = await manager.localize(req, draft, 'fr');
    });

    it('sets localizedAt on a document after localize', async function () {
      assert(localizedDoc.localizedAt, 'localizedAt should be set after localizing');
      assert(localizedDoc.localizedAt instanceof Date);

      // Verify it persists in the DB
      const dbDoc = await apos.doc.db.findOne({ _id: localizedDoc._id });
      assert(dbDoc.localizedAt);
    });

    it('localizedAt action filter returns all localized docs', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { _action: 'localized' }
        }
      );
      // 1 fr article (just localized) + 4 parked fr/de docs with localizedAt
      // (2 home-page + 2 global, both fr and de localized from en during parking)
      assert.equal(response.results.length, 5);
      const localized = response.results.find(
        r => r.title === 'Localize Timestamp Test'
      );
      assert(localized, 'Our localized article should be in results');
    });
  });

  // ───── getBrowserData ─────

  describe('getBrowserData', function () {
    it('includes managedTypes in browser data', function () {
      const req = apos.task.getReq({ mode: 'draft' });
      const data = apos.recentlyEdited.getBrowserData(req);
      assert(Array.isArray(data.managedTypes));
      assert(data.managedTypes.length > 0);
      const articleType = data.managedTypes.find(t => t.name === 'article');
      assert(articleType);
      assert.equal(articleType.label, 'Article');
    });

    it('includes perPage and rollingWindowDays', function () {
      const req = apos.task.getReq({ mode: 'draft' });
      const data = apos.recentlyEdited.getBrowserData(req);
      assert.equal(data.perPage, 50);
      assert.equal(data.rollingWindowDays, 30);
    });

    it('has empty batchOperations', function () {
      const req = apos.task.getReq({ mode: 'draft' });
      const data = apos.recentlyEdited.getBrowserData(req);
      assert(Array.isArray(data.batchOperations));
      assert.equal(data.batchOperations.length, 0);
    });

    it('overrides managerModal component', function () {
      const req = apos.task.getReq({ mode: 'draft' });
      const data = apos.recentlyEdited.getBrowserData(req);
      assert.equal(data.components.managerModal, 'AposRecentlyEditedManager');
    });

    it('includes showRestore and showUnpublish from options', function () {
      const req = apos.task.getReq({ mode: 'draft' });
      const data = apos.recentlyEdited.getBrowserData(req);
      assert.equal(data.showRestore, false);
      assert.equal(data.showUnpublish, false);
    });
  });

  // ───── Admin Bar Registration ─────

  describe('admin bar registration', function () {
    it('registers in the admin bar as contextUtility', function () {
      const item = apos.adminBar.items.find(
        i => i.action === '@apostrophecms/recently-edited:manager'
      );
      assert(item);
      assert.equal(item.options.contextUtility, true);
      assert.equal(item.options.component, 'AposRecentlyEditedIcon');
    });
  });

  // ───── Modal Registration ─────

  describe('modal registration', function () {
    it('registers the manager modal', function () {
      const modals = apos.modal.modals || [];
      const found = modals.find(
        m => m.itemName === '@apostrophecms/recently-edited:manager'
      );
      assert(found);
      assert.equal(found.componentName, 'AposRecentlyEditedManager');
    });
  });

  // ───── addContextOperation crossLocale validation (core doc change) ─────

  describe('addContextOperation crossLocale validation', function () {
    it('accepts crossLocale as a boolean (true)', function () {
      assert.doesNotThrow(() => {
        apos.doc.addContextOperation({
          action: 'test-cross-locale-true',
          context: 'update',
          label: 'Test CL True',
          modal: 'AposTestModal',
          crossLocale: true
        });
      });
    });

    it('accepts crossLocale as a boolean (false)', function () {
      assert.doesNotThrow(() => {
        apos.doc.addContextOperation({
          action: 'test-cross-locale-false',
          context: 'update',
          label: 'Test CL False',
          modal: 'AposTestModal',
          crossLocale: false
        });
      });
    });

    it('accepts operation without crossLocale (undefined)', function () {
      assert.doesNotThrow(() => {
        apos.doc.addContextOperation({
          action: 'test-no-cross-locale',
          context: 'update',
          label: 'Test No CL',
          modal: 'AposTestModal'
        });
      });
    });

    it('rejects non-boolean crossLocale', function () {
      assert.throws(() => {
        apos.doc.addContextOperation({
          action: 'test-cross-locale-bad',
          context: 'update',
          label: 'Test CL Bad',
          modal: 'AposTestModal',
          crossLocale: 'yes'
        });
      }, /crossLocale.*must be a boolean/);
    });

    it('stores crossLocale in contextOperations for browser data', function () {
      const op = apos.doc.contextOperations.find(
        o => o.action === 'test-cross-locale-true'
      );
      assert(op);
      assert.equal(op.crossLocale, true);

      // Clean up test operations
      apos.doc.contextOperations = apos.doc.contextOperations.filter(
        o => !o.action.startsWith('test-')
      );
    });
  });

  // ───── Pagination & Infinite Scroll ─────

  describe('pagination for infinite scroll', function () {
    // Known data:
    // - 8 articles (en)
    // - 6 parked managed docs (3 home-page + 3 global)
    // Total: 14 docs. With perPage=3 → 5 pages (3 + 3 + 3 + 3 + 2)

    before(async function () {
      await cleanDocs();
      for (let i = 1; i <= 8; i++) {
        await insertPiece('article', { title: `Scroll Article ${i}` });
      }
    });

    it('returns correct pagination metadata', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: {
            perPage: 3,
            page: 1
          }
        }
      );
      assert.equal(response.currentPage, 1);
      assert.equal(response.pages, 5);
      assert.equal(response.results.length, 3);
    });

    it('returns subsequent pages with no overlap', async function () {
      const page1 = await apos.http.get(
        recentApi(), {
          jar,
          qs: {
            perPage: 3,
            page: 1
          }
        }
      );
      const page2 = await apos.http.get(
        recentApi(), {
          jar,
          qs: {
            perPage: 3,
            page: 2
          }
        }
      );
      assert.equal(page1.results.length, 3);
      assert.equal(page2.results.length, 3);
      const page1Ids = new Set(page1.results.map(r => r._id));
      for (const doc of page2.results) {
        assert(!page1Ids.has(doc._id), 'Page 2 should not overlap with page 1');
      }
    });

    it('last page returns remaining items', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: {
            perPage: 3,
            page: 5
          }
        }
      );
      assert.equal(response.results.length, 2);
      assert.equal(response.currentPage, 5);
    });

    it('returns empty results for page beyond total', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: {
            perPage: 3,
            page: 999
          }
        }
      );
      assert.equal(response.results.length, 0);
    });
  });

  // ───── Combined Filters + Choices ─────

  describe('combined filters with choices', function () {
    // Known data:
    // - 3 admin articles (en) via insertPiece (updatedBy stamped to admin), 1 published
    // - 2 editor topics (en) via insertPiece (updatedBy stamped to combo-editor)
    // - 6 parked docs (3 home + 3 global)
    // Total: 11 draft docs (non-archived)
    let comboEditorId;
    let adminUser;

    before(async function () {
      await cleanDocs();

      comboEditorId = 'simulated-combo-editor-id';
      const comboEditorUpdatedBy = {
        _id: comboEditorId,
        title: 'combo-editor',
        username: 'combo-editor'
      };

      adminUser = await apos.doc.db.findOne({
        type: '@apostrophecms/user',
        username: 'admin'
      });
      const adminUpdatedBy = {
        _id: adminUser._id,
        title: adminUser.title,
        username: adminUser.username
      };

      for (let i = 1; i <= 3; i++) {
        const article = await insertPiece('article', {
          title: `Combo Article ${i}`
        });
        await apos.doc.db.updateOne(
          { _id: article._id },
          { $set: { updatedBy: adminUpdatedBy } }
        );
      }

      for (let i = 1; i <= 2; i++) {
        const topic = await insertPiece('topic', {
          title: `Combo Topic ${i}`
        });
        await apos.doc.db.updateOne(
          { _id: topic._id },
          { $set: { updatedBy: comboEditorUpdatedBy } }
        );
      }

      // Publish one article
      const req = apos.task.getReq({ mode: 'draft' });
      const draft = await apos.modules.article
        .find(req, {})
        .sort({ createdAt: 1 })
        .toObject();
      await apos.modules.article.publish(req, draft);
    });

    it('_docType filter narrows _editedBy choices to matching editors', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: {
            _docType: [ 'topic' ],
            choices: '_editedBy'
          }
        }
      );
      // 2 topics, both by combo-editor
      assert.equal(response.results.length, 2);
      assert.equal(response.choices._editedBy.length, 1);
      assert.equal(response.choices._editedBy[0].value, comboEditorId);
    });

    it('_editedBy filter narrows _docType choices to matching types', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: {
            _editedBy: adminUser._id,
            choices: '_docType'
          }
        }
      );
      // Admin created only articles (3), so only 'article' type appears
      assert.equal(response.results.length, 3);
      const values = response.choices._docType.map(c => c.value);
      assert.deepEqual(values.sort(), [ 'article' ]);
    });

    it('_docType + _status combined: article AND live', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: {
            _docType: [ 'article' ],
            _status: 'live',
            choices: '_editedBy,_locale'
          }
        }
      );
      // 1 published article
      assert.equal(response.results.length, 1);
      assert.equal(response.results[0].type, 'article');
      assert(response.results[0].lastPublishedAt);
      // Choices reflect the filtered results
      assert(response.choices._editedBy.length >= 1);
      assert(response.choices._locale.length >= 1);
    });
  });

  // ───── distinctFromQuery helper ─────

  describe('distinctFromQuery', function () {
    before(async function () {
      await cleanDocs();
      await insertPiece('article', { title: 'Distinct Test A' });
      await insertPiece('topic', { title: 'Distinct Test B' });
    });

    it('returns distinct values for a property', async function () {
      const req = apos.task.getReq({ mode: 'draft' });
      const query = apos.recentlyEdited.find(req);
      const types = await apos.recentlyEdited.distinctFromQuery(query, 'type');
      assert(types.includes('article'));
      assert(types.includes('topic'));
    });

    it('does not inherit pagination from the parent query', async function () {
      const req = apos.task.getReq({ mode: 'draft' });
      const query = apos.recentlyEdited.find(req).perPage(1).page(1);
      const types = await apos.recentlyEdited.distinctFromQuery(query, 'type');
      // Even with perPage=1, distinct should return all types
      assert(types.length >= 2);
    });
  });

  // ───── Edge Cases ─────

  describe('edge cases', function () {
    describe('empty state', function () {
      before(async function () {
        await cleanDocs();
      });

      it('returns only parked docs when no user documents exist', async function () {
        const response = await apos.http.get(recentApi(), { jar });
        // 6 parked docs: 3 home-page + 3 global (en, fr, de)
        assert.equal(response.results.length, 6);
        const types = [ ...new Set(response.results.map(r => r.type)) ].sort();
        assert.deepEqual(types, [
          '@apostrophecms/global',
          '@apostrophecms/home-page'
        ]);
        const allTypes = response.results.map(r => r.type);
        assert(!allTypes.includes('@apostrophecms/archive-page'));
      });
    });

    describe('draft-only results', function () {
      before(async function () {
        await cleanDocs();
        const piece = await insertPiece('article', { title: 'Mode Test' });
        const req = apos.task.getReq({ mode: 'draft' });
        await apos.modules.article.publish(req, piece);
      });

      it('never returns published-mode docs', async function () {
        const response = await apos.http.get(recentApi(), { jar });
        for (const doc of response.results) {
          assert(
            doc.aposLocale.endsWith(':draft'),
            `Expected draft mode, got ${doc.aposLocale}`
          );
        }
      });
    });

    describe('lean mode', function () {
      let pageId;

      before(async function () {
        await cleanDocs();
        const page = await insertPage({
          title: 'Lean Page Edge Test',
          type: 'default-page'
        });
        pageId = page._id;
      });

      it('getRestQuery applies lean mode to disable addUrls', async function () {
        const response = await apos.http.get(
          recentApi(), {
            jar,
            qs: {
              lean: 1,
              _docType: [ 'default-page' ]
            }
          }
        );
        assert.equal(response.results.length, 1);
        assert.equal(response.results[0]._id, pageId);
        // Pages store _url in MongoDB — lean skips addUrls post-processing
        // but the stored value persists via projection
        assert(response.results[0]._url);
      });
    });
  });

  // ───── Security & Laundering ─────

  describe('security and laundering', function () {
    before(async function () {
      await cleanDocs();
      await insertPiece('article', { title: 'Security Test Article' });
      await insertPiece('topic', { title: 'Security Test Topic' });
    });

    it('never returns @apostrophecms/user docs even when explicitly requested', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { _docType: [ '@apostrophecms/user' ] }
        }
      );
      for (const doc of response.results) {
        assert.notEqual(
          doc.type,
          '@apostrophecms/user',
          'User docs must never appear in recently-edited results'
        );
      }
    });

    it('never returns @apostrophecms/recently-edited docs (self-type)', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { _docType: [ '@apostrophecms/recently-edited' ] }
        }
      );
      for (const doc of response.results) {
        assert.notEqual(doc.type, '@apostrophecms/recently-edited');
      }
    });

    it('never returns excluded types even when explicitly requested', async function () {
      // Insert an excluded article directly in DB to bypass type checks
      await apos.doc.db.insertOne({
        _id: 'excluded-test-id:en:draft',
        aposDocId: 'excluded-test-id',
        aposLocale: 'en:draft',
        aposMode: 'draft',
        type: 'excluded-article',
        slug: 'excluded-test',
        title: 'Should Not Appear',
        visibility: 'public',
        updatedAt: new Date()
      });

      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { _docType: [ 'excluded-article' ] }
        }
      );
      for (const doc of response.results) {
        assert.notEqual(
          doc.type,
          'excluded-article',
          'Excluded types must never appear'
        );
      }
    });

    it('launders non-managed types out of _docType filter', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: {
            _docType: [
              '@apostrophecms/archive-page',
              '@apostrophecms/submitted-draft'
            ]
          }
        }
      );
      // Both types are non-managed → laundered out → empty filter → all results
      // 2 user docs + 6 parked = 8
      assert.equal(response.results.length, 8);
    });

    it('launders unknown _status values to null (no filter)', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { _status: 'hacked' }
        }
      );
      // Unknown status launders to null, returns all
      // 2 user docs + 6 parked = 8
      assert.equal(response.results.length, 8);
    });

    it('launders unknown _action values to null (no filter)', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { _action: 'DROP TABLE docs' }
        }
      );
      // Unknown action launders to null, returns all
      // 2 user docs + 6 parked = 8
      assert.equal(response.results.length, 8);
    });

    it('launders _locale with non-configured locale to null (no filter)', async function () {
      const response = await apos.http.get(
        recentApi(), {
          jar,
          qs: { _locale: 'xx' }
        }
      );
      // Unknown locale launders to null, returns all
      // 2 user docs + 6 parked = 8
      assert.equal(response.results.length, 8);
    });
  });
});
