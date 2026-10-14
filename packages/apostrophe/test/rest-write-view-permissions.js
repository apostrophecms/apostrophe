// Regression tests for GHSA-vh56-5m88-39rq: the documents returned by the
// page and piece REST APIs after a write (POST, PUT, PATCH, publish,
// unpublish, revert, localize, share...) must not include fields restricted
// by `viewPermission`, in the saved document or in its related documents,
// when the user lacks that permission. Saving a document without those fields
// in the request body must also never lose their stored values.

const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('REST API writes: viewPermission fields in responses (GHSA-vh56-5m88-39rq)', function() {
  let apos;
  let note;
  let counter = 0;
  const jars = {};

  this.timeout(t.timeout);

  // Editors can edit and publish everything except users, so this
  // restricts the fields to admins while editors can still save the
  // documents
  const viewPermission = {
    action: 'edit',
    type: '@apostrophecms/user'
  };

  const notesField = {
    type: 'relationship',
    label: 'Notes',
    withType: 'note-piece'
  };

  const secrets = [ 'NOTE-SECRET', 'ARTICLE-SECRET', 'PAGE-SECRET' ];

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
              }
            }
          }
        },
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
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              pageSecret: {
                type: 'string',
                label: 'Page Secret',
                viewPermission
              },
              _notes: notesField
            }
          }
        },
        'note-piece': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              noteSecret: {
                type: 'string',
                label: 'Note Secret',
                viewPermission
              }
            }
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              articleSecret: {
                type: 'string',
                label: 'Article Secret',
                viewPermission
              },
              _notes: notesField
            }
          }
        }
      }
    });

    for (const role of [ 'admin', 'editor' ]) {
      await t.createUser(apos, role);
      jars[role] = await t.loginAs(apos, role);
      await apos.http.get('/', { jar: jars[role] });
    }

    const req = apos.task.getReq({ mode: 'draft' });
    note = await apos.modules['note-piece'].insert(req, {
      ...apos.modules['note-piece'].newInstance(),
      title: 'Related Note',
      noteSecret: 'NOTE-SECRET-VALUE'
    });
    await apos.modules['note-piece'].publish(req, note);
  });

  after(async function() {
    return t.destroy(apos);
  });

  async function insertArticle({ publish = true } = {}) {
    const req = apos.task.getReq({ mode: 'draft' });
    const article = await apos.modules.article.insert(req, {
      ...apos.modules.article.newInstance(),
      title: `Article ${++counter}`,
      articleSecret: 'ARTICLE-SECRET-VALUE',
      _notes: [ note ]
    });
    if (publish) {
      await apos.modules.article.publish(req, article);
    }
    return article;
  }

  async function insertPage({ publish = true } = {}) {
    const req = apos.task.getReq({ mode: 'draft' });
    const page = await apos.page.insert(req, '_home', 'lastChild', {
      title: `Page ${++counter}`,
      type: 'test-page',
      slug: `/page-${counter}`,
      pageSecret: 'PAGE-SECRET-VALUE',
      _notes: [ note ]
    });
    if (publish) {
      await apos.page.publish(req, page);
    }
    return page;
  }

  function assertNoSecrets(response) {
    const json = JSON.stringify(response);
    for (const secret of secrets) {
      assert.ok(!json.includes(secret), `${secret} leaked`);
    }
  }

  function assertRelatedNoteLoaded(doc) {
    assert.equal(doc._notes[0].title, 'Related Note');
  }

  async function stored(_id, field) {
    const doc = await apos.doc.db.findOne({ _id });
    return doc[field];
  }

  // Write requests are made in draft mode, as the admin UI makes them
  const http = {};
  for (const method of [ 'post', 'put', 'patch' ]) {
    http[method] = (url, options) => apos.http[method](url, {
      ...options,
      qs: {
        aposMode: 'draft'
      }
    });
  }

  function piecePath(doc, suffix = '') {
    return `/api/v1/article/${doc._id}${suffix}`;
  }

  function pagePath(doc, suffix = '') {
    return `/api/v1/@apostrophecms/page/${doc._id}${suffix}`;
  }

  describe('pieces', function() {
    it('admin: PUT and publish responses include viewPermission fields', async function() {
      const article = await insertArticle();
      const doc = await apos.http.get(piecePath(article), { jar: jars.admin });
      const updated = await http.put(piecePath(article), {
        jar: jars.admin,
        body: {
          ...doc,
          title: 'Admin Update'
        }
      });
      assert.equal(updated.articleSecret, 'ARTICLE-SECRET-VALUE');
      assert.equal(updated._notes[0].noteSecret, 'NOTE-SECRET-VALUE');
      const published = await http.post(piecePath(article, '/publish'), {
        jar: jars.admin,
        body: {}
      });
      assert.equal(published.articleSecret, 'ARTICLE-SECRET-VALUE');
      assert.equal(published._notes[0].noteSecret, 'NOTE-SECRET-VALUE');
    });

    it('editor: POST response does not include viewPermission fields', async function() {
      const doc = await http.post('/api/v1/article', {
        jar: jars.editor,
        body: {
          title: 'Posted Article',
          _notes: [ note ]
        }
      });
      assert.equal(doc.title, 'Posted Article');
      assertRelatedNoteLoaded(doc);
      assert.ok(!('articleSecret' in doc));
      assertNoSecrets(doc);
    });

    it('editor: PUT response does not include viewPermission fields', async function() {
      const article = await insertArticle();
      const doc = await apos.http.get(piecePath(article), { jar: jars.editor });
      const updated = await http.put(piecePath(article), {
        jar: jars.editor,
        body: {
          ...doc,
          title: 'Editor Update'
        }
      });
      assert.equal(updated.title, 'Editor Update');
      assertRelatedNoteLoaded(updated);
      assertNoSecrets(updated);
    });

    it('editor: PATCH response does not include viewPermission fields', async function() {
      const article = await insertArticle();
      const updated = await http.patch(piecePath(article), {
        jar: jars.editor,
        body: {
          title: 'Editor Patch'
        }
      });
      assert.equal(updated.title, 'Editor Patch');
      assertRelatedNoteLoaded(updated);
      assertNoSecrets(updated);
    });

    it('editor: PATCH with _publish does not include viewPermission fields', async function() {
      const article = await insertArticle();
      const updated = await http.patch(piecePath(article), {
        jar: jars.editor,
        body: {
          title: 'Editor Patch And Publish',
          _publish: true
        }
      });
      assertRelatedNoteLoaded(updated);
      assertNoSecrets(updated);
    });

    it('editor: archive and restore via PATCH do not return viewPermission fields', async function() {
      const article = await insertArticle();
      const archived = await http.patch(piecePath(article), {
        jar: jars.editor,
        body: {
          archived: true
        }
      });
      assert.equal(archived.archived, true);
      assertNoSecrets(archived);
      const restored = await http.patch(piecePath(article), {
        jar: jars.editor,
        body: {
          archived: false
        }
      });
      assert.equal(restored.archived, false);
      assertNoSecrets(restored);
    });

    it('editor: publish response does not include viewPermission fields', async function() {
      const article = await insertArticle({ publish: false });
      const published = await http.post(piecePath(article, '/publish'), {
        jar: jars.editor,
        body: {}
      });
      assertRelatedNoteLoaded(published);
      assertNoSecrets(published);
    });

    it('editor: unpublish response does not include viewPermission fields', async function() {
      const article = await insertArticle();
      const response = await http.post(piecePath(article, '/unpublish'), {
        jar: jars.editor,
        body: {}
      });
      assertNoSecrets(response);
    });

    it('editor: revert-draft-to-published response does not include viewPermission fields', async function() {
      const article = await insertArticle();
      await http.patch(piecePath(article), {
        jar: jars.editor,
        body: {
          title: 'Modified Draft'
        }
      });
      const reverted = await http.post(piecePath(article, '/revert-draft-to-published'), {
        jar: jars.editor,
        body: {}
      });
      assert.notEqual(reverted.title, 'Modified Draft');
      assertRelatedNoteLoaded(reverted);
      assertNoSecrets(reverted);
    });

    it('editor: revert-published-to-previous response does not include viewPermission fields', async function() {
      const article = await insertArticle();
      await http.patch(piecePath(article), {
        jar: jars.editor,
        body: {
          title: 'Second Publication',
          _publish: true
        }
      });
      const reverted = await http.post(piecePath(article, '/revert-published-to-previous'), {
        jar: jars.editor,
        body: {}
      });
      assert.ok(reverted && reverted._id);
      assertNoSecrets(reverted);
    });

    it('editor: localize response does not include viewPermission fields', async function() {
      const article = await insertArticle();
      const localized = await http.post(piecePath(article, '/localize'), {
        jar: jars.editor,
        body: {
          toLocale: 'fr'
        }
      });
      assert.equal(localized.aposLocale, 'fr:draft');
      assertNoSecrets(localized);
    });

    it('editor: share response does not include viewPermission fields', async function() {
      const article = await insertArticle();
      const shared = await http.post(piecePath(article, '/share'), {
        jar: jars.editor,
        body: {
          share: true
        }
      });
      assert.ok(shared && shared._id);
      assertNoSecrets(shared);
    });

    it('editor: doc GET one does not include viewPermission fields', async function() {
      const article = await insertArticle();
      const doc = await apos.http.get(`/api/v1/@apostrophecms/doc/${article._id}`, {
        jar: jars.editor
      });
      assert.equal(doc._id, article._id);
      assertNoSecrets(doc);
    });
  });

  describe('pages', function() {
    it('admin: PUT and publish responses include viewPermission fields', async function() {
      const page = await insertPage();
      const doc = await apos.http.get(pagePath(page), { jar: jars.admin });
      const updated = await http.put(pagePath(page), {
        jar: jars.admin,
        body: {
          ...doc,
          title: 'Admin Page Update'
        }
      });
      assert.equal(updated.pageSecret, 'PAGE-SECRET-VALUE');
      assert.equal(updated._notes[0].noteSecret, 'NOTE-SECRET-VALUE');
      const published = await http.post(pagePath(page, '/publish'), {
        jar: jars.admin,
        body: {}
      });
      assert.equal(published.pageSecret, 'PAGE-SECRET-VALUE');
    });

    it('editor: POST response does not include viewPermission fields', async function() {
      const doc = await http.post('/api/v1/@apostrophecms/page', {
        jar: jars.editor,
        body: {
          title: 'Posted Page',
          type: 'test-page',
          _targetId: '_home',
          _position: 'lastChild',
          _notes: [ note ]
        }
      });
      assert.equal(doc.title, 'Posted Page');
      assertRelatedNoteLoaded(doc);
      assert.ok(!('pageSecret' in doc));
      assertNoSecrets(doc);
    });

    it('editor: POST copying a page does not include viewPermission fields', async function() {
      const page = await insertPage();
      const doc = await http.post('/api/v1/@apostrophecms/page', {
        jar: jars.editor,
        body: {
          title: 'Copied Page',
          type: 'test-page',
          _targetId: '_home',
          _position: 'lastChild',
          _copyingId: page._id
        }
      });
      assert.equal(doc.title, 'Copied Page');
      assertNoSecrets(doc);
    });

    it('editor: PUT response does not include viewPermission fields', async function() {
      const page = await insertPage();
      const doc = await apos.http.get(pagePath(page), { jar: jars.editor });
      const updated = await http.put(pagePath(page), {
        jar: jars.editor,
        body: {
          ...doc,
          title: 'Editor Page Update'
        }
      });
      assert.equal(updated.title, 'Editor Page Update');
      assertRelatedNoteLoaded(updated);
      assertNoSecrets(updated);
    });

    it('editor: PATCH response does not include viewPermission fields', async function() {
      const page = await insertPage();
      const updated = await http.patch(pagePath(page), {
        jar: jars.editor,
        body: {
          title: 'Editor Page Patch'
        }
      });
      assert.equal(updated.title, 'Editor Page Patch');
      assertRelatedNoteLoaded(updated);
      assertNoSecrets(updated);
    });

    it('editor: PATCH moving a page does not include viewPermission fields', async function() {
      const parent = await insertPage();
      const page = await insertPage();
      const moved = await http.patch(pagePath(page), {
        jar: jars.editor,
        body: {
          _targetId: parent._id,
          _position: 'firstChild'
        }
      });
      assert.equal(moved.level, 2);
      assertNoSecrets(moved);
    });

    it('editor: archive via PATCH does not return viewPermission fields', async function() {
      const page = await insertPage();
      const archived = await http.patch(pagePath(page), {
        jar: jars.editor,
        body: {
          archived: true,
          _targetId: '_archive',
          _position: 'lastChild'
        }
      });
      assert.equal(archived.archived, true);
      assertNoSecrets(archived);
    });

    it('editor: publish response does not include viewPermission fields', async function() {
      const page = await insertPage({ publish: false });
      const published = await http.post(pagePath(page, '/publish'), {
        jar: jars.editor,
        body: {}
      });
      assertRelatedNoteLoaded(published);
      assertNoSecrets(published);
    });

    it('editor: unpublish response does not include viewPermission fields', async function() {
      const page = await insertPage();
      const response = await http.post(pagePath(page, '/unpublish'), {
        jar: jars.editor,
        body: {}
      });
      assertNoSecrets(response);
    });

    it('editor: revert-draft-to-published response does not include viewPermission fields', async function() {
      const page = await insertPage();
      await http.patch(pagePath(page), {
        jar: jars.editor,
        body: {
          title: 'Modified Page Draft'
        }
      });
      const reverted = await http.post(pagePath(page, '/revert-draft-to-published'), {
        jar: jars.editor,
        body: {}
      });
      assert.notEqual(reverted.title, 'Modified Page Draft');
      assertNoSecrets(reverted);
    });

    it('editor: revert-published-to-previous response does not include viewPermission fields', async function() {
      const page = await insertPage();
      await http.patch(pagePath(page), {
        jar: jars.editor,
        body: {
          title: 'Second Page Publication'
        }
      });
      await http.post(pagePath(page, '/publish'), {
        jar: jars.editor,
        body: {}
      });
      const reverted = await http.post(pagePath(page, '/revert-published-to-previous'), {
        jar: jars.editor,
        body: {}
      });
      assert.ok(reverted && reverted._id);
      assertNoSecrets(reverted);
    });

    it('editor: localize response does not include viewPermission fields', async function() {
      const page = await insertPage();
      const localized = await http.post(pagePath(page, '/localize'), {
        jar: jars.editor,
        body: {
          toLocale: 'fr'
        }
      });
      assert.equal(localized.aposLocale, 'fr:draft');
      assertNoSecrets(localized);
    });

    it('editor: share response does not include viewPermission fields', async function() {
      const page = await insertPage();
      const shared = await http.post(pagePath(page, '/share'), {
        jar: jars.editor,
        body: {
          share: true
        }
      });
      assert.ok(shared.aposShareKey);
      assertNoSecrets(shared);
    });
  });

  // The admin UI saves the document it received from the REST API, which
  // lacks the fields the user may not view: their stored values must be kept
  describe('stored values of fields the user may not view are preserved', function() {
    it('piece: GET, modify, PUT', async function() {
      const article = await insertArticle();
      const doc = await apos.http.get(piecePath(article), { jar: jars.editor });
      assert.ok(!('articleSecret' in doc));
      const updated = await http.put(piecePath(article), {
        jar: jars.editor,
        body: {
          ...doc,
          title: 'Preserved PUT'
        }
      });
      // Save again from the PUT response, as the editor modal may
      await http.put(piecePath(article), {
        jar: jars.editor,
        body: {
          ...updated,
          title: 'Preserved PUT Again'
        }
      });
      assert.equal(await stored(article._id, 'title'), 'Preserved PUT Again');
      assert.equal(await stored(article._id, 'articleSecret'), 'ARTICLE-SECRET-VALUE');
    });

    it('piece: PATCH', async function() {
      const article = await insertArticle();
      await http.patch(piecePath(article), {
        jar: jars.editor,
        body: {
          title: 'Preserved PATCH'
        }
      });
      assert.equal(await stored(article._id, 'title'), 'Preserved PATCH');
      assert.equal(await stored(article._id, 'articleSecret'), 'ARTICLE-SECRET-VALUE');
    });

    it('piece: PUT and PATCH cannot set a field the user may not view', async function() {
      const article = await insertArticle();
      const doc = await apos.http.get(piecePath(article), { jar: jars.editor });
      await http.put(piecePath(article), {
        jar: jars.editor,
        body: {
          ...doc,
          articleSecret: 'OVERWRITTEN'
        }
      });
      await http.patch(piecePath(article), {
        jar: jars.editor,
        body: {
          articleSecret: 'OVERWRITTEN'
        }
      });
      assert.equal(await stored(article._id, 'articleSecret'), 'ARTICLE-SECRET-VALUE');
    });

    it('piece: publish keeps the field in the published document', async function() {
      const article = await insertArticle({ publish: false });
      await http.post(piecePath(article, '/publish'), {
        jar: jars.editor,
        body: {}
      });
      const publishedId = article._id.replace(':draft', ':published');
      assert.equal(await stored(publishedId, 'articleSecret'), 'ARTICLE-SECRET-VALUE');
    });

    it('page: GET, modify, PUT', async function() {
      const page = await insertPage();
      const doc = await apos.http.get(pagePath(page), { jar: jars.editor });
      assert.ok(!('pageSecret' in doc));
      const updated = await http.put(pagePath(page), {
        jar: jars.editor,
        body: {
          ...doc,
          title: 'Preserved Page PUT'
        }
      });
      await http.put(pagePath(page), {
        jar: jars.editor,
        body: {
          ...updated,
          title: 'Preserved Page PUT Again'
        }
      });
      assert.equal(await stored(page._id, 'title'), 'Preserved Page PUT Again');
      assert.equal(await stored(page._id, 'pageSecret'), 'PAGE-SECRET-VALUE');
    });

    it('page: PATCH', async function() {
      const page = await insertPage();
      await http.patch(pagePath(page), {
        jar: jars.editor,
        body: {
          title: 'Preserved Page PATCH'
        }
      });
      assert.equal(await stored(page._id, 'title'), 'Preserved Page PATCH');
      assert.equal(await stored(page._id, 'pageSecret'), 'PAGE-SECRET-VALUE');
    });

    it('related document: saving a document does not change its related documents', async function() {
      const article = await insertArticle();
      const doc = await apos.http.get(piecePath(article), { jar: jars.editor });
      await http.put(piecePath(article), {
        jar: jars.editor,
        body: doc
      });
      assert.equal(await stored(note._id, 'noteSecret'), 'NOTE-SECRET-VALUE');
    });
  });
});
