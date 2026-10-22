// Regression tests for GHSA-2j32-q6rx-h844: the page REST API (GET one,
// the `all=1` page tree and `autocomplete`) must honor "view" permissions,
// i.e. page `visibility` (`loginRequired`) and page type `viewRole`, just as
// the rest of the page REST API and the piece REST API do.

const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Pages REST - view permissions (GHSA-2j32-q6rx-h844)', function() {
  let apos;
  let publicPage;
  let loginRequiredPage;
  let adminOnlyPage;
  let adminOnlyChild;
  let lockedPage;
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
                name: 'admin-only-page',
                label: 'Admin Only Page'
              },
              {
                name: 'locked-page',
                label: 'Locked Page'
              }
            ]
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
        // Only admins may even view pages of this type
        'admin-only-page': {
          extend: '@apostrophecms/page-type',
          options: {
            viewRole: 'admin'
          },
          fields: {
            add: {
              secretData: {
                type: 'string',
                label: 'Secret Data'
              }
            }
          }
        },
        // Anyone may view, only admins may edit: must still appear in the
        // page tree for editors
        'locked-page': {
          extend: '@apostrophecms/page-type',
          options: {
            editRole: 'admin',
            publishRole: 'admin'
          }
        }
      }
    });

    for (const role of [ 'admin', 'editor', 'contributor', 'guest' ]) {
      await t.createUser(apos, role);
      jars[role] = await t.loginAs(apos, role);
    }

    const req = apos.task.getReq();
    const insert = async (targetId, page) => {
      const draft = await apos.page.insert(req, targetId, 'lastChild', page);
      await apos.page.publish(req, draft);
      return draft;
    };
    publicPage = await insert('_home', {
      title: 'Public Page',
      type: 'test-page',
      slug: '/public-page',
      editorNotes: 'EDITOR-NOTES-VALUE'
    });
    loginRequiredPage = await insert('_home', {
      title: 'Login Required Page',
      type: 'test-page',
      slug: '/login-required-page',
      visibility: 'loginRequired'
    });
    adminOnlyPage = await insert('_home', {
      title: 'Admin Only Page',
      type: 'admin-only-page',
      slug: '/admin-only-page',
      secretData: 'TOP-SECRET-VALUE'
    });
    adminOnlyChild = await insert(adminOnlyPage._id, {
      title: 'Admin Only Child',
      type: 'admin-only-page',
      slug: '/admin-only-page/child',
      secretData: 'TOP-SECRET-CHILD-VALUE'
    });
    lockedPage = await insert('_home', {
      title: 'Locked Page',
      type: 'locked-page',
      slug: '/locked-page'
    });
  });

  after(async function() {
    return t.destroy(apos);
  });

  afterEach(function() {
    delete apos.page.options.publicApiProjection;
  });

  function setPublicApiProjection() {
    apos.page.options.publicApiProjection = {
      title: 1,
      slug: 1,
      type: 1,
      path: 1,
      level: 1,
      rank: 1,
      visibility: 1,
      secretData: 1,
      _url: 1
    };
  }

  function published(page) {
    return `${page.aposDocId}:en:published`;
  }

  async function getOne(page, jar, mode = 'published') {
    return apos.http.get(
      `/api/v1/@apostrophecms/page/${page.aposDocId}:en:${mode}`,
      { jar }
    );
  }

  async function assertCannotGetOne(page, jar, mode) {
    await assert.rejects(
      getOne(page, jar, mode),
      (e) => {
        assert.ok([ 403, 404 ].includes(e.status), `unexpected status ${e.status}`);
        assert.ok(!JSON.stringify(e.body || {}).includes('TOP-SECRET'));
        return true;
      }
    );
  }

  async function getTree(jar) {
    const { results } = await apos.http.get('/api/v1/@apostrophecms/page', {
      jar,
      qs: {
        all: '1',
        flat: '1'
      }
    });
    return results;
  }

  async function autocomplete(jar, term) {
    const { results } = await apos.http.get('/api/v1/@apostrophecms/page', {
      jar,
      qs: {
        autocomplete: term
      }
    });
    return results;
  }

  function ids(pages) {
    // aposDocId may not be part of a public API projection
    return pages.map(page => page._id.split(':')[0]);
  }

  // Anonymous visitors

  it('anonymous: cannot GET any page without a publicApiProjection', async function() {
    await assert.rejects(getOne(publicPage), { status: 404 });
    await assert.rejects(getOne(adminOnlyPage), { status: 404 });
  });

  it('anonymous with publicApiProjection: can GET a public page', async function() {
    setPublicApiProjection();
    const page = await getOne(publicPage);
    assert.equal(page._id, published(publicPage));
    assert.equal(page.title, 'Public Page');
  });

  it('anonymous with publicApiProjection: cannot GET a loginRequired page', async function() {
    setPublicApiProjection();
    await assertCannotGetOne(loginRequiredPage);
  });

  it('anonymous with publicApiProjection: cannot GET a page type with viewRole: admin', async function() {
    setPublicApiProjection();
    await assertCannotGetOne(adminOnlyPage);
    await assertCannotGetOne(adminOnlyChild);
  });

  it('anonymous with publicApiProjection: page tree only contains pages they can view', async function() {
    setPublicApiProjection();
    const tree = ids(await getTree());
    assert.ok(tree.includes(publicPage.aposDocId));
    assert.ok(tree.includes(lockedPage.aposDocId));
    assert.ok(!tree.includes(loginRequiredPage.aposDocId));
    assert.ok(!tree.includes(adminOnlyPage.aposDocId));
    assert.ok(!tree.includes(adminOnlyChild.aposDocId));
  });

  it('anonymous with publicApiProjection: autocomplete only returns pages they can view', async function() {
    setPublicApiProjection();
    const results = ids(await autocomplete(undefined, 'page'));
    assert.ok(results.includes(publicPage.aposDocId));
    assert.ok(!results.includes(loginRequiredPage.aposDocId));
    assert.ok(!results.includes(adminOnlyPage.aposDocId));
  });

  it('anonymous: cannot view a page type with viewRole: admin on the site', async function() {
    await assert.rejects(
      apos.http.get('/admin-only-page', {}),
      { status: 404 }
    );
    const req = apos.task.getAnonReq();
    assert.equal(apos.permission.can(req, 'view', 'admin-only-page'), false);
    assert.equal(apos.permission.can(req, 'view', 'test-page'), true);
    assert.ok(
      !await apos.page.find(req, { aposDocId: adminOnlyPage.aposDocId }).toObject()
    );
  });

  // Guests (logged in, no API access of their own)

  it('guest with publicApiProjection: can GET a loginRequired page but not a viewRole: admin page', async function() {
    setPublicApiProjection();
    const page = await getOne(loginRequiredPage, jars.guest);
    assert.equal(page._id, published(loginRequiredPage));
    await assertCannotGetOne(adminOnlyPage, jars.guest);
  });

  // Contributors and editors

  for (const role of [ 'contributor', 'editor' ]) {
    it(`${role}: can GET public and loginRequired pages`, async function() {
      const page = await getOne(publicPage, jars[role]);
      assert.equal(page._id, published(publicPage));
      const page2 = await getOne(loginRequiredPage, jars[role]);
      assert.equal(page2._id, published(loginRequiredPage));
      const page3 = await getOne(lockedPage, jars[role], 'draft');
      assert.equal(page3.title, 'Locked Page');
    });

    it(`${role}: cannot GET a page type with viewRole: admin`, async function() {
      await assertCannotGetOne(adminOnlyPage, jars[role]);
      await assertCannotGetOne(adminOnlyPage, jars[role], 'draft');
      await assertCannotGetOne(adminOnlyChild, jars[role]);
    });

    it(`${role}: page tree excludes viewRole: admin pages but keeps pages they cannot edit`, async function() {
      const tree = ids(await getTree(jars[role]));
      assert.ok(tree.includes(publicPage.aposDocId));
      assert.ok(tree.includes(loginRequiredPage.aposDocId));
      assert.ok(tree.includes(lockedPage.aposDocId));
      assert.ok(!tree.includes(adminOnlyPage.aposDocId));
      assert.ok(!tree.includes(adminOnlyChild.aposDocId));
    });

    it(`${role}: autocomplete excludes viewRole: admin pages`, async function() {
      const results = ids(await autocomplete(jars[role], 'page'));
      assert.ok(results.includes(publicPage.aposDocId));
      assert.ok(results.includes(loginRequiredPage.aposDocId));
      assert.ok(!results.includes(adminOnlyPage.aposDocId));
    });
  }

  it('contributor: GET does not return fields restricted by viewPermission', async function() {
    const page = await getOne(publicPage, jars.contributor, 'draft');
    assert.equal(page.title, 'Public Page');
    assert.equal(page.editorNotes, undefined);
  });

  it('editor: GET returns fields allowed by viewPermission', async function() {
    const page = await getOne(publicPage, jars.editor, 'draft');
    assert.equal(page.editorNotes, 'EDITOR-NOTES-VALUE');
  });

  // Admins

  it('admin: can GET, list and autocomplete everything', async function() {
    const page = await getOne(adminOnlyPage, jars.admin);
    assert.equal(page.secretData, 'TOP-SECRET-VALUE');
    const tree = ids(await getTree(jars.admin));
    assert.ok(tree.includes(adminOnlyPage.aposDocId));
    assert.ok(tree.includes(adminOnlyChild.aposDocId));
    assert.ok(tree.includes(loginRequiredPage.aposDocId));
    const results = ids(await autocomplete(jars.admin, 'page'));
    assert.ok(results.includes(adminOnlyPage.aposDocId));
  });
});
