const assert = require('node:assert/strict');
const t = require('../test-lib/test');

// Writing the published version of a document is publishing it, so it is
// governed by the type's `publishRole`, and by the published-mode rules
// whatever mode the request is in (GHSA-5m22-7pfq-vp65).

describe('Permissions for published documents', function() {
  this.timeout(t.timeout);

  let apos;
  let editorJar;
  let contributorJar;

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'plain-article': {
          extend: '@apostrophecms/piece-type'
        },
        'restricted-article': {
          extend: '@apostrophecms/piece-type',
          options: {
            publishRole: 'admin'
          }
        },
        'auto-article': {
          extend: '@apostrophecms/piece-type',
          options: {
            autopublish: true,
            publishRole: 'admin'
          }
        }
      }
    });
    await t.createUser(apos, 'editor', {
      username: 'pm-editor',
      password: 'pm-editor-password'
    });
    await t.createUser(apos, 'contributor', {
      username: 'pm-contributor',
      password: 'pm-contributor-password'
    });
    editorJar = await t.loginAs(apos, 'pm-editor', 'pm-editor-password');
    contributorJar = await t.loginAs(apos, 'pm-contributor', 'pm-contributor-password');
    // The CSRF cookie
    await apos.http.get('/', { jar: editorJar });
    await apos.http.get('/', { jar: contributorJar });
  });

  after(function() {
    return t.destroy(apos);
  });

  // Inserts and publishes a document as an admin, returns its published
  // version
  async function insertPublished(type, title) {
    const manager = apos.modules[type];
    await manager.insert(apos.task.getReq(), {
      ...manager.newInstance(),
      title
    });
    return apos.doc.db.findOne({
      type,
      title,
      aposLocale: 'en:published'
    });
  }

  async function getTitle(_id) {
    const doc = await apos.doc.db.findOne({ _id });
    return doc && doc.title;
  }

  function editorReq(mode) {
    return apos.task.getEditorReq({ mode });
  }

  function contributorReq(mode) {
    return apos.task.getContributorReq({ mode });
  }

  async function assertForbidden(fn) {
    await assert.rejects(fn, e => (e.name === 'forbidden') || (e.message === 'forbidden'));
  }

  describe('publishRole', function() {
    it('is required to edit or create published documents of the type', async function() {
      const published = await insertPublished('restricted-article', 'Restricted can');
      const draft = await apos.doc.db.findOne({
        _id: published._id.replace(':published', ':draft')
      });
      assert.equal(apos.permission.can(editorReq('published'), 'edit', published), false);
      assert.equal(apos.permission.can(editorReq('draft'), 'edit', published), false);
      assert.equal(apos.permission.can(editorReq('published'), 'create', {
        type: 'restricted-article',
        aposMode: 'published'
      }), false);
      // Checks by type name tell whether the user can edit the type at all,
      // the UI relies on that
      assert.equal(apos.permission.can(editorReq('published'), 'edit', 'restricted-article'), true);
      assert.equal(apos.permission.can(editorReq('draft'), 'edit', 'restricted-article'), true);
      assert.equal(apos.permission.can(editorReq('draft'), 'create', 'restricted-article'), true);
      assert.equal(apos.permission.can(editorReq('draft'), 'edit', draft), true);
      assert.equal(apos.permission.can(apos.task.getAdminReq({ mode: 'published' }), 'edit', published), true);
    });

    it('is not required by types without a stronger publishRole', async function() {
      const published = await insertPublished('plain-article', 'Plain can');
      assert.equal(apos.permission.can(editorReq('published'), 'edit', 'plain-article'), true);
      assert.equal(apos.permission.can(editorReq('published'), 'edit', published), true);
    });

    it('forbids an editor to update a published document of the type', async function() {
      const published = await insertPublished('restricted-article', 'Restricted update');
      published.title = 'Restricted update hacked';
      await assertForbidden(() => apos.doc.update(editorReq('published'), published));
      assert.equal(await getTitle(published._id), 'Restricted update');
    });

    it('forbids an editor to insert a published document of the type', async function() {
      const manager = apos.modules['restricted-article'];
      await assertForbidden(() => manager.insert(editorReq('published'), {
        ...manager.newInstance(),
        title: 'Restricted insert'
      }));
      assert.equal(await apos.doc.db.countDocuments({ title: 'Restricted insert' }), 0);
    });

    it('still allows an editor to update the draft of the type', async function() {
      const published = await insertPublished('restricted-article', 'Restricted draft');
      const draft = await apos.doc.db.findOne({
        _id: published._id.replace(':published', ':draft')
      });
      draft.title = 'Restricted draft edited';
      await apos.doc.update(editorReq('draft'), draft);
      assert.equal(await getTitle(draft._id), 'Restricted draft edited');
      assert.equal(await getTitle(published._id), 'Restricted draft');
    });

    it('still allows an editor to update a published document of an ordinary type', async function() {
      const published = await insertPublished('plain-article', 'Plain update');
      published.title = 'Plain update edited';
      await apos.doc.update(editorReq('published'), published);
      assert.equal(await getTitle(published._id), 'Plain update edited');
    });

    it('still allows an editor to edit an autopublished type, whatever its publishRole', async function() {
      const published = await insertPublished('auto-article', 'Auto update');
      const draft = await apos.doc.db.findOne({
        _id: published._id.replace(':published', ':draft')
      });
      draft.title = 'Auto update edited';
      await apos.doc.update(editorReq('draft'), draft);
      assert.equal(await getTitle(draft._id), 'Auto update edited');
      assert.equal(await getTitle(published._id), 'Auto update edited');
    });

    it('is reflected in the edit criteria', async function() {
      await insertPublished('restricted-article', 'Restricted criteria');
      await insertPublished('plain-article', 'Plain criteria');
      const restricted = await apos.doc.find(editorReq('published'), {
        title: 'Restricted criteria'
      }).permission('edit').toArray();
      assert.equal(restricted.length, 0);
      const restrictedDrafts = await apos.doc.find(editorReq('draft'), {
        title: 'Restricted criteria'
      }).permission('edit').toArray();
      assert.equal(restrictedDrafts.length, 1);
      const plain = await apos.doc.find(editorReq('published'), {
        title: 'Plain criteria'
      }).permission('edit').toArray();
      assert.equal(plain.length, 1);
    });

    it('forbids an editor to update a published document of the type via REST', async function() {
      const published = await insertPublished('restricted-article', 'Restricted REST');
      await assert.rejects(() => apos.http.patch(`/api/v1/restricted-article/${published._id}`, {
        body: {
          title: 'Restricted REST hacked'
        },
        jar: editorJar
      }), e => [ 403, 404 ].includes(e.status));
      await assert.rejects(() => apos.http.put(`/api/v1/restricted-article/${published._id}`, {
        body: {
          ...published,
          title: 'Restricted REST hacked'
        },
        jar: editorJar
      }), e => [ 403, 404 ].includes(e.status));
      assert.equal(await getTitle(published._id), 'Restricted REST');
    });

    it('forbids an editor to insert a published document of the type via REST', async function() {
      await assert.rejects(() => apos.http.post('/api/v1/restricted-article?aposMode=published', {
        body: {
          title: 'Restricted REST insert'
        },
        jar: editorJar
      }), e => e.status === 403);
      assert.equal(await apos.doc.db.countDocuments({ title: 'Restricted REST insert' }), 0);
    });

    it('still allows an editor to update a published document of an ordinary type via REST', async function() {
      const published = await insertPublished('plain-article', 'Plain REST');
      await apos.http.patch(`/api/v1/plain-article/${published._id}`, {
        body: {
          title: 'Plain REST edited'
        },
        jar: editorJar
      });
      assert.equal(await getTitle(published._id), 'Plain REST edited');
    });
  });

  describe('the mode of the document', function() {
    it('decides the rules rather than the mode of the request', async function() {
      const published = await insertPublished('plain-article', 'Mode can');
      const draft = await apos.doc.db.findOne({
        _id: published._id.replace(':published', ':draft')
      });
      assert.equal(apos.permission.can(contributorReq('draft'), 'edit', published), false);
      assert.equal(apos.permission.can(contributorReq('draft'), 'edit', draft), true);
      assert.equal(apos.permission.can(contributorReq('draft'), 'edit', published, 'draft'), false);
      // A type has no mode of its own, the mode of the request still applies
      assert.equal(apos.permission.can(contributorReq('draft'), 'edit', 'plain-article'), true);
      assert.equal(apos.permission.can(contributorReq('published'), 'edit', 'plain-article'), false);
    });

    it('forbids a contributor in draft mode to update a published document', async function() {
      const published = await insertPublished('plain-article', 'Mode update');
      published.title = 'Mode update hacked';
      await assertForbidden(() => apos.doc.update(contributorReq('draft'), published));
      assert.equal(await getTitle(published._id), 'Mode update');
    });

    it('forbids a contributor in draft mode to insert a published document', async function() {
      const manager = apos.modules['plain-article'];
      const aposDocId = apos.util.generateId();
      await assertForbidden(() => manager.insert(contributorReq('draft'), {
        ...manager.newInstance(),
        _id: `${aposDocId}:en:published`,
        title: 'Mode insert'
      }));
      assert.equal(await apos.doc.db.countDocuments({ title: 'Mode insert' }), 0);
    });

    it('forbids an editor in draft mode to update a published document of a type with a stronger publishRole', async function() {
      const published = await insertPublished('restricted-article', 'Mode restricted update');
      published.title = 'Mode restricted update hacked';
      await assertForbidden(() => apos.doc.update(editorReq('draft'), published));
      assert.equal(await getTitle(published._id), 'Mode restricted update');
    });

    it('forbids a contributor to update a published document via REST in draft mode', async function() {
      const published = await insertPublished('plain-article', 'Mode REST');
      await assert.rejects(() => apos.http.patch(`/api/v1/plain-article/${published._id}`, {
        body: {
          title: 'Mode REST hacked'
        },
        jar: contributorJar
      }), e => [ 403, 404 ].includes(e.status));
      assert.equal(await getTitle(published._id), 'Mode REST');
    });

    it('still allows a contributor to update a draft', async function() {
      const published = await insertPublished('plain-article', 'Mode draft');
      const draft = await apos.doc.db.findOne({
        _id: published._id.replace(':published', ':draft')
      });
      draft.title = 'Mode draft edited';
      await apos.doc.update(contributorReq('draft'), draft);
      assert.equal(await getTitle(draft._id), 'Mode draft edited');
      assert.equal(await getTitle(published._id), 'Mode draft');
    });
  });
});
