// Regression tests for GHSA-vh56-5m88-39rq: the page and piece REST APIs
// must enforce type-level `viewRole` and remove fields restricted by
// `viewPermission` for every response, including GET of a single document by
// `_id` and the related pages (`_ancestors`, `_children`) embedded in
// responses, just as they do for the list views.

const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('REST API GET one: viewRole and viewPermission (GHSA-vh56-5m88-39rq)', function() {
  let apos;
  let home;
  let publicPage;
  let secretPage;
  let secretPiece;
  let notePiece;
  const jars = {};

  this.timeout(t.timeout);

  before(async function() {
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
              },
              {
                name: 'secret-page',
                label: 'Secret Page'
              }
            ]
          }
        },
        '@apostrophecms/home-page': {
          fields: {
            add: {
              homeNotes: {
                type: 'string',
                label: 'Home Notes',
                viewPermission: {
                  action: 'publish',
                  type: '@apostrophecms/home-page'
                }
              }
            }
          }
        },
        'test-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              editorNotes: {
                type: 'string',
                label: 'Editor Notes',
                viewPermission: {
                  action: 'publish',
                  type: 'test-page'
                }
              }
            }
          }
        },
        // As in the report: only admins may view this page type at all
        'secret-page': {
          extend: '@apostrophecms/page-type',
          options: {
            viewRole: 'admin'
          },
          fields: {
            add: {
              secretField: {
                type: 'string',
                label: 'Secret Field',
                viewPermission: {
                  action: 'edit',
                  type: '@apostrophecms/page'
                }
              }
            }
          }
        },
        'secret-piece': {
          extend: '@apostrophecms/piece-type',
          options: {
            viewRole: 'admin'
          },
          fields: {
            add: {
              secretField: {
                type: 'string',
                label: 'Secret Field'
              }
            }
          }
        },
        'note-piece': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              editorNotes: {
                type: 'string',
                label: 'Editor Notes',
                viewPermission: {
                  action: 'publish',
                  type: 'note-piece'
                }
              }
            }
          }
        }
      }
    });

    for (const role of [ 'admin', 'editor', 'contributor' ]) {
      await t.createUser(apos, role);
      jars[role] = await t.loginAs(apos, role);
    }

    const req = apos.task.getReq();
    const insert = async (targetId, page) => {
      const draft = await apos.page.insert(req, targetId, 'lastChild', page);
      await apos.page.publish(req, draft);
      return draft;
    };
    home = await apos.page.find(req, { level: 0 }).toObject();
    await apos.page.update(req, {
      ...home,
      homeNotes: 'HOME-NOTES-VALUE'
    });
    await apos.page.publish(req, home);
    publicPage = await insert('_home', {
      title: 'Public Page',
      type: 'test-page',
      slug: '/public-page',
      editorNotes: 'EDITOR-NOTES-VALUE'
    });
    await insert(publicPage._id, {
      title: 'Child Page',
      type: 'test-page',
      slug: '/public-page/child',
      editorNotes: 'EDITOR-NOTES-CHILD-VALUE'
    });
    secretPage = await insert('_home', {
      title: 'Secret Page',
      type: 'secret-page',
      slug: '/secret-page',
      secretField: 'TOP-SECRET-VALUE'
    });
    secretPiece = await apos.modules['secret-piece'].insert(req, {
      ...apos.modules['secret-piece'].newInstance(),
      title: 'Secret Piece',
      secretField: 'TOP-SECRET-PIECE-VALUE'
    });
    notePiece = await apos.modules['note-piece'].insert(req, {
      ...apos.modules['note-piece'].newInstance(),
      title: 'Note Piece',
      editorNotes: 'EDITOR-NOTES-PIECE-VALUE'
    });
  });

  after(async function() {
    return t.destroy(apos);
  });

  function getOnePage(page, jar, mode = 'published') {
    return apos.http.get(
      `/api/v1/@apostrophecms/page/${page.aposDocId}:en:${mode}`,
      { jar }
    );
  }

  function getOnePiece(type, piece, jar, mode = 'published') {
    return apos.http.get(
      `/api/v1/${type}/${piece.aposDocId}:en:${mode}`,
      { jar }
    );
  }

  async function assertNotFound(promise) {
    await assert.rejects(promise, (e) => {
      assert.ok([ 403, 404 ].includes(e.status), `unexpected status ${e.status}`);
      assert.ok(!JSON.stringify(e.body || {}).includes('TOP-SECRET'));
      return true;
    });
  }

  function assertNoRestrictedValues(response) {
    const json = JSON.stringify(response);
    assert.ok(!json.includes('TOP-SECRET'), 'viewRole: admin content leaked');
    assert.ok(!json.includes('EDITOR-NOTES'), 'viewPermission field leaked');
    assert.ok(!json.includes('HOME-NOTES'), 'viewPermission field leaked');
  }

  for (const role of [ 'editor', 'contributor' ]) {
    it(`${role}: cannot GET a page of a type with viewRole: admin by _id`, async function() {
      await assertNotFound(getOnePage(secretPage, jars[role]));
      await assertNotFound(getOnePage(secretPage, jars[role], 'draft'));
    });

    it(`${role}: cannot list pages of a type with viewRole: admin`, async function() {
      let results = [];
      try {
        ({ results } = await apos.http.get('/api/v1/@apostrophecms/page', {
          jar: jars[role],
          qs: { type: 'secret-page' }
        }));
      } catch (e) {
        assert.ok([ 403, 404 ].includes(e.status));
      }
      assert.equal(results.length, 0);
    });

    it(`${role}: cannot GET a piece of a type with viewRole: admin by _id`, async function() {
      await assertNotFound(getOnePiece('secret-piece', secretPiece, jars[role]));
      await assertNotFound(getOnePiece('secret-piece', secretPiece, jars[role], 'draft'));
    });
  }

  it('editor: can GET fields allowed by viewPermission', async function() {
    const page = await getOnePage(publicPage, jars.editor, 'draft');
    assert.equal(page.editorNotes, 'EDITOR-NOTES-VALUE');
    const piece = await getOnePiece('note-piece', notePiece, jars.editor, 'draft');
    assert.equal(piece.editorNotes, 'EDITOR-NOTES-PIECE-VALUE');
  });

  it('contributor: GET one page does not return viewPermission fields, including in _ancestors and _children', async function() {
    const page = await getOnePage(publicPage, jars.contributor, 'draft');
    assert.equal(page.title, 'Public Page');
    assert.equal(page._ancestors[0].title, home.title);
    assert.equal(page._children[0].title, 'Child Page');
    assertNoRestrictedValues(page);
  });

  it('contributor: GET one piece does not return viewPermission fields', async function() {
    const piece = await getOnePiece('note-piece', notePiece, jars.contributor, 'draft');
    assert.equal(piece.title, 'Note Piece');
    assertNoRestrictedValues(piece);
  });

  it('contributor: GET home page does not return viewPermission fields', async function() {
    const page = await apos.http.get('/api/v1/@apostrophecms/page', {
      jar: jars.contributor
    });
    assert.equal(page.slug, '/');
    assertNoRestrictedValues(page);
  });

  it('contributor: page tree does not return viewPermission fields', async function() {
    const tree = await apos.http.get('/api/v1/@apostrophecms/page', {
      jar: jars.contributor,
      qs: { all: '1' }
    });
    assert.equal(tree.slug, '/');
    assertNoRestrictedValues(tree);
  });

  it('contributor: autocomplete does not return viewPermission fields', async function() {
    const { results } = await apos.http.get('/api/v1/@apostrophecms/page', {
      jar: jars.contributor,
      qs: { autocomplete: 'page' }
    });
    assert.ok(results.find(page => page.title === 'Public Page'));
    assertNoRestrictedValues(results);
  });

  it('contributor: list of pages of a type does not return viewPermission fields', async function() {
    const { results } = await apos.http.get('/api/v1/@apostrophecms/page', {
      jar: jars.contributor,
      qs: { type: 'test-page' }
    });
    assert.ok(results.find(page => page.title === 'Public Page'));
    assertNoRestrictedValues(results);
  });

  it('admin: can GET everything', async function() {
    const page = await getOnePage(secretPage, jars.admin);
    assert.equal(page.secretField, 'TOP-SECRET-VALUE');
    const piece = await getOnePiece('secret-piece', secretPiece, jars.admin);
    assert.equal(piece.secretField, 'TOP-SECRET-PIECE-VALUE');
    const withChild = await getOnePage(publicPage, jars.admin);
    assert.equal(withChild._children[0].editorNotes, 'EDITOR-NOTES-CHILD-VALUE');
  });
});
