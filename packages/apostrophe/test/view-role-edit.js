// Regression tests for GHSA-9wx5-rxfg-8rpw: a user who cannot view a type
// because of its `viewRole` must not be able to edit, create or delete its
// docs either, since the routes that authorize on `edit` return the doc.

const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('viewRole: edit, create and delete (GHSA-9wx5-rxfg-8rpw)', function() {
  let apos;
  let vault;
  let lockedPage;
  let memo;
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
                name: 'locked-page',
                label: 'Locked Page'
              }
            ]
          }
        },
        // As in the report: admin-only to view, default editRole
        vault: {
          extend: '@apostrophecms/piece-type',
          options: {
            viewRole: 'admin'
          },
          fields: {
            add: {
              secretNote: {
                type: 'string',
                label: 'Secret Note'
              }
            }
          }
        },
        'locked-page': {
          extend: '@apostrophecms/page-type',
          options: {
            viewRole: 'admin'
          },
          fields: {
            add: {
              secretNote: {
                type: 'string',
                label: 'Secret Note'
              }
            }
          }
        },
        // Contributors may view this type, so they may still edit it
        memo: {
          extend: '@apostrophecms/piece-type',
          options: {
            viewRole: 'contributor'
          }
        }
      }
    });

    for (const role of [ 'admin', 'editor', 'contributor' ]) {
      await t.createUser(apos, role);
      jars[role] = await t.loginAs(apos, role);
    }

    const req = apos.task.getReq();
    vault = await apos.modules.vault.insert(req, {
      ...apos.modules.vault.newInstance(),
      title: 'Board minutes',
      secretNote: 'SECRET-VAULT-VALUE'
    });
    lockedPage = await apos.page.insert(req, '_home', 'lastChild', {
      title: 'Locked Page',
      type: 'locked-page',
      slug: '/locked-page',
      secretNote: 'SECRET-PAGE-VALUE'
    });
    await apos.page.publish(req, lockedPage);
    memo = await apos.modules.memo.insert(req, {
      ...apos.modules.memo.newInstance(),
      title: 'Memo'
    });
  });

  after(async function() {
    return t.destroy(apos);
  });

  function draftId(doc) {
    return `${doc.aposDocId}:en:draft`;
  }

  async function assertRefused(promise) {
    await assert.rejects(promise, (e) => {
      assert.ok([ 403, 404 ].includes(e.status), `unexpected status ${e.status}`);
      assert.ok(!JSON.stringify(e.body || {}).includes('SECRET'));
      return true;
    });
  }

  async function storedNote(doc) {
    const stored = await apos.doc.db.findOne({ _id: draftId(doc) });
    return stored && stored.secretNote;
  }

  for (const role of [ 'editor', 'contributor' ]) {
    it(`${role}: cannot edit, create or delete a type it cannot view`, function() {
      const req = apos.task.getReq({
        role,
        mode: 'draft'
      });
      for (const type of [ 'vault', 'locked-page' ]) {
        assert.equal(apos.permission.can(req, 'view', type), false);
        assert.equal(apos.permission.can(req, 'edit', type), false);
        assert.equal(apos.permission.can(req, 'create', type), false);
      }
      const draft = {
        ...vault,
        _id: draftId(vault),
        aposMode: 'draft'
      };
      assert.equal(apos.permission.can(req, 'edit', draft), false);
      assert.equal(apos.permission.can(req, 'delete', draft), false);
    });

    it(`${role}: does not find docs of a type it cannot view for editing`, async function() {
      const req = apos.task.getReq({
        role,
        mode: 'draft'
      });
      for (const action of [ 'edit', 'delete' ]) {
        const found = await apos.doc.find(req, {
          type: { $in: [ 'vault', 'locked-page' ] }
        }).permission(action).toArray();
        assert.deepEqual(found, []);
      }
    });

    it(`${role}: cannot GET a doc of a type it cannot view via the doc API`, async function() {
      await assertRefused(apos.http.get(
        `/api/v1/@apostrophecms/doc/${draftId(vault)}`,
        { jar: jars[role] }
      ));
      await assertRefused(apos.http.get(
        `/api/v1/@apostrophecms/doc/${draftId(lockedPage)}`,
        { jar: jars[role] }
      ));
    });

    it(`${role}: cannot PATCH or PUT a piece of a type it cannot view`, async function() {
      await assertRefused(apos.http.patch(`/api/v1/vault/${draftId(vault)}`, {
        jar: jars[role],
        body: { secretNote: `PATCHED-BY-${role}` }
      }));
      await assertRefused(apos.http.put(`/api/v1/vault/${draftId(vault)}`, {
        jar: jars[role],
        body: {
          title: 'Board minutes',
          secretNote: `PUT-BY-${role}`
        }
      }));
      assert.equal(await storedNote(vault), 'SECRET-VAULT-VALUE');
    });

    it(`${role}: cannot PATCH a page of a type it cannot view`, async function() {
      await assertRefused(apos.http.patch(`/api/v1/@apostrophecms/page/${draftId(lockedPage)}`, {
        jar: jars[role],
        body: { secretNote: `PATCHED-BY-${role}` }
      }));
      assert.equal(await storedNote(lockedPage), 'SECRET-PAGE-VALUE');
    });

    it(`${role}: cannot DELETE the draft of a doc of a type it cannot view`, async function() {
      await assertRefused(apos.http.delete(`/api/v1/vault/${draftId(vault)}`, {
        jar: jars[role]
      }));
      assert.equal(await storedNote(vault), 'SECRET-VAULT-VALUE');
    });

    it(`${role}: can still edit a type whose viewRole it meets`, async function() {
      const req = apos.task.getReq({
        role,
        mode: 'draft'
      });
      assert.equal(apos.permission.can(req, 'edit', 'memo'), true);
      const patched = await apos.http.patch(`/api/v1/memo/${draftId(memo)}`, {
        jar: jars[role],
        body: { title: `Memo by ${role}` }
      });
      assert.equal(patched.title, `Memo by ${role}`);
    });
  }

  it('anonymous and guest users cannot edit a type with a viewRole', function() {
    for (const req of [ apos.task.getAnonReq(), apos.task.getGuestReq() ]) {
      assert.equal(apos.permission.can(req, 'edit', 'vault'), false);
      assert.equal(apos.permission.can(req, 'edit', 'memo'), false);
    }
  });

  it('admin: can still read and edit a type with viewRole: admin', async function() {
    const doc = await apos.http.get(
      `/api/v1/@apostrophecms/doc/${draftId(vault)}`,
      { jar: jars.admin }
    );
    assert.equal(doc.secretNote, 'SECRET-VAULT-VALUE');
    const patched = await apos.http.patch(`/api/v1/vault/${draftId(vault)}`, {
      jar: jars.admin,
      body: { title: 'Board minutes v2' }
    });
    assert.equal(patched.title, 'Board minutes v2');
    assert.equal(patched.secretNote, 'SECRET-VAULT-VALUE');
  });
});
