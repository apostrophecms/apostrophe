// Regression tests for GHSA-wr5r-wqp2-x4fh:
// "Missing destination-parent authorization in page move() allows a
//  low-privileged editor to move and re-rank pages inside a restricted subtree"
//
// A regression in the move() authorization guard silently disabled the
// destination "create" permission check for every normal (non-archive) move.
// The only surviving gate was moved._edit ("can the actor edit the page being
// moved"), which an editor legitimately holds for their own ordinary pages.
// As a result a non-admin editor could relocate a page they control under a
// parent of a restricted page type (e.g. one declaring editRole: 'admin')
// that they have no create/edit rights over, and in doing so trigger an
// unchecked updateMany that re-ranks the restricted parent's existing
// children (documents the actor cannot edit).
//
// These tests exercise the real apos.page.move() code path (and the REST
// route it backs) with a non-admin request and assert that the destination
// authorization boundary is enforced, while confirming legitimate moves and
// the archive restore flow are still permitted.

const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('pages - move destination permission (GHSA-wr5r-wqp2-x4fh)', function () {
  this.timeout(t.timeout);

  let apos;
  let homeId;

  after(async function () {
    await t.destroy(apos);
    apos = null;
  });

  before(async function () {
    apos = await t.create({
      root: module,
      modules: {
        // A restricted page type: only admins may create/edit pages of this
        // type. This is the same shape as the core @apostrophecms/archive-page
        // (editRole/publishRole: 'admin') and of restricted "section" page
        // types projects commonly configure.
        'secret-page': {
          extend: '@apostrophecms/page-type',
          options: {
            editRole: 'admin',
            publishRole: 'admin'
          }
        },
        // An ordinary page type any editor may create/edit.
        'public-page': {
          extend: '@apostrophecms/page-type'
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
                name: 'secret-page',
                label: 'Secret'
              },
              {
                name: 'public-page',
                label: 'Public'
              }
            ]
          }
        }
      }
    });

    const home = await apos.page
      .find(apos.task.getReq({ role: 'admin' }), { level: 0 })
      .toObject();
    assert.ok(home, 'home page should exist');
    homeId = home._id;
  });

  // A non-admin editor request. Editors may create/edit ordinary pages but
  // NOT pages of a type gated by editRole: 'admin'.
  function editorReq() {
    return apos.task.getReq({
      role: 'editor',
      user: {
        _id: 'editor-user',
        title: 'Editor',
        role: 'editor'
      }
    });
  }

  function adminReq() {
    return apos.task.getReq({ role: 'admin' });
  }

  // Create an admin-only "secret" section with one pre-existing admin-only
  // child, plus an ordinary editor-editable page under home. `slugPrefix`
  // keeps each test's fixtures independent within the shared database.
  async function fixtures(slugPrefix) {
    const admin = adminReq();

    const secret = await apos.page.insert(admin, homeId, 'lastChild', {
      title: 'Secret Section',
      type: 'secret-page',
      slug: `/${slugPrefix}-secret`
    });
    const secretChild = await apos.page.insert(admin, secret._id, 'lastChild', {
      title: 'Secret Child',
      type: 'secret-page',
      slug: `/${slugPrefix}-secret/child`
    });
    const mine = await apos.page.insert(admin, homeId, 'lastChild', {
      title: 'My Page',
      type: 'public-page',
      slug: `/${slugPrefix}-mine`
    });

    return {
      secret,
      secretChild,
      mine
    };
  }

  it('precondition: an editor has no create/edit rights on an admin-only section', async function () {
    const { secret } = await fixtures('precondition');

    const secretForEditor = await apos.page
      .find(editorReq(), { _id: secret._id })
      .permission(false)
      .toObject();

    assert.ok(secretForEditor, 'the section is locatable regardless of rights');
    assert.notEqual(
      secretForEditor._create,
      true,
      'editor must NOT have create rights on the admin-only section'
    );
    assert.notEqual(
      secretForEditor._edit,
      true,
      'editor must NOT have edit rights on the admin-only section'
    );
  });

  it('forbids an editor from moving their page under an admin-only section', async function () {
    const { secret, mine } = await fixtures('forbid-move');

    await assert.rejects(
      apos.page.move(editorReq(), mine._id, secret._id, 'firstChild'),
      { name: 'forbidden' },
      'moving a page under a parent the actor cannot create within must be forbidden'
    );

    // The page must NOT have been relocated under the restricted branch.
    const moved = await apos.page
      .find(adminReq(), { _id: mine._id })
      .toObject();
    assert.ok(
      !moved.path.includes(secret.aposDocId),
      'the editor must not have relocated their page under the admin-only section'
    );
  });

  it('does not re-rank an admin-only section\'s protected children on a forbidden move', async function () {
    const {
      secret, secretChild, mine
    } = await fixtures('no-rerank');

    const before = await apos.page
      .find(adminReq(), { _id: secretChild._id })
      .toObject();

    // 'firstChild' would place the moved page at rank 0 and (if the move were
    // wrongly allowed) nudge the pre-existing admin-only child from rank 0 to
    // rank 1 via an unchecked updateMany.
    await assert.rejects(
      apos.page.move(editorReq(), mine._id, secret._id, 'firstChild'),
      { name: 'forbidden' }
    );

    const after = await apos.page
      .find(adminReq(), { _id: secretChild._id })
      .toObject();

    assert.equal(
      after.rank,
      before.rank,
      'the protected sibling\'s rank must be untouched by a forbidden move'
    );
  });

  it('still allows an editor to move their page under a parent they may create within', async function () {
    const { mine } = await fixtures('allow-move');

    // Another ordinary parent the editor legitimately controls.
    const otherParent = await apos.page.insert(adminReq(), homeId, 'lastChild', {
      title: 'Other Parent',
      type: 'public-page',
      slug: '/allow-move-other'
    });

    // Sanity: the editor genuinely has create rights on the destination.
    const otherForEditor = await apos.page
      .find(editorReq(), { _id: otherParent._id })
      .permission(false)
      .toObject();
    assert.equal(
      otherForEditor._create,
      true,
      'precondition: editor has create rights on the ordinary destination'
    );

    await assert.doesNotReject(
      apos.page.move(editorReq(), mine._id, otherParent._id, 'firstChild'),
      'a move into a destination the editor may create within must be allowed'
    );

    const moved = await apos.page.find(adminReq(), { _id: mine._id }).toObject();
    assert.ok(
      moved.path.includes(otherParent.aposDocId),
      'the page should now live under the permitted destination'
    );
  });

  it('still allows an admin to move a page under the admin-only section', async function () {
    const { secret, mine } = await fixtures('admin-move');

    await assert.doesNotReject(
      apos.page.move(adminReq(), mine._id, secret._id, 'firstChild'),
      'an admin has create rights on the section and may move pages into it'
    );

    const moved = await apos.page.find(adminReq(), { _id: mine._id }).toObject();
    assert.ok(
      moved.path.includes(secret.aposDocId),
      'the admin-moved page should live under the section'
    );
  });

  it('still allows archiving a page and restoring it out of the archive', async function () {
    // Exercises the guard\'s archive-restore branch: a move whose old parent
    // is the archive page must remain permitted for a destination the actor
    // may edit. Using an editor on an ordinary page they fully control.
    const { mine } = await fixtures('restore');

    // Archive: moves the page under the archive (old parent becomes archive).
    await assert.doesNotReject(
      apos.page.archive(editorReq(), mine._id),
      'an editor may archive their own ordinary page'
    );

    const archived = await apos.page
      .find(adminReq(), { _id: mine._id })
      .archived(null)
      .ancestors({ archived: null })
      .toObject();
    assert.equal(archived.archived, true, 'the page should be archived');
    assert.equal(
      archived._ancestors[archived._ancestors.length - 1].type,
      '@apostrophecms/archive-page',
      'the archived page\'s parent should be the archive'
    );

    // Restore: move it back out of the archive, under home.
    await assert.doesNotReject(
      apos.page.move(editorReq(), mine._id, homeId, 'lastChild'),
      'restoring a page out of the archive to a destination the actor may edit must be allowed'
    );

    const restored = await apos.page
      .find(adminReq(), { _id: mine._id })
      .toObject();
    assert.ok(restored, 'the restored page should be live again');
    assert.notEqual(restored.archived, true, 'the restored page should not be archived');
  });

  it('forbids the same move over the REST PATCH route for a logged-in editor', async function () {
    const { secret, mine } = await fixtures('rest');

    // A real, logged-in editor session.
    await t.createUser(apos, 'editor', { username: 'rest-editor' });
    const jar = await t.loginAs(apos, 'rest-editor');
    // A safe request first, so the jar carries the CSRF cookie the write
    // routes require. Otherwise the PATCH is rejected for CSRF before it can
    // ever reach move(), which would mask the authorization check under test.
    await apos.http.get('/', { jar });

    const draftId = mine._id.replace(':published', ':draft');
    const targetDraftId = secret._id.replace(':published', ':draft');

    let status = null;
    try {
      await apos.http.patch(`/api/v1/@apostrophecms/page/${draftId}`, {
        body: {
          _targetId: targetDraftId,
          _position: 'firstChild'
        },
        jar
      });
    } catch (e) {
      status = e.status;
    }

    assert.equal(status, 403, 'the REST move must be rejected with 403 Forbidden');

    // Confirm no relocation happened.
    const moved = await apos.page.find(adminReq(), { _id: mine._id }).toObject();
    assert.ok(
      !moved.path.includes(secret.aposDocId),
      'the editor must not have relocated their page under the admin-only section via REST'
    );
  });
});
