const assert = require('assert');
const t = require('../test-lib/test');
const { permissionSetsByRole: expectedPermissionSetsByRole } = require('./utils/permissions');

describe('Permissions', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module
    });
  });

  after(function() {
    return t.destroy(apos);
  });

  it('should have a permissions property', async function() {
    assert(apos.permission.__meta.name = '@apostrophecms/permission');
  });

  describe('methods', function() {
    describe('can', function() {
      it('allows the public to view by type', function() {
        assert(apos.permission.can(apos.task.getAnonReq(), 'view', '@apostrophecms/home-page'));
      });
      it('allows the admin to view by type', function() {
        assert(apos.permission.can(apos.task.getAdminReq(), 'view', '@apostrophecms/home-page'));
      });
      it('Forbids the public to update by type', function() {
        assert(!apos.permission.can(apos.task.getAnonReq(), 'edit', '@apostrophecms/home-page'));
      });
      it('Forbids the contributor to update by type in published mode', function() {
        assert(!apos.permission.can(apos.task.getContributorReq(), 'edit', '@apostrophecms/home-page'));
      });
      it('Allows the editor to update by type in published mode', function() {
        assert(apos.permission.can(apos.task.getEditorReq(), 'edit', '@apostrophecms/home-page'));
      });
      it('Allows the admin to update by type', function() {
        assert(apos.permission.can(apos.task.getAdminReq(), 'edit', '@apostrophecms/home-page'));
      });
      it('allows the public to view a particular doc via criteria and via can()', async function() {
        const req = apos.task.getAnonReq();
        const home = await apos.page.find(req, { slug: '/' }).toObject();
        assert(home);
        assert(apos.permission.can(apos.task.getAnonReq(), 'view', home));
      });
      it('public cannot update via actual update api', async function() {
        const req = apos.task.getAnonReq();
        const home = await apos.page.find(req, { slug: '/' }).toObject();
        assert(home);
        try {
          home.visibility = 'loginRequired';
          await apos.page.update(req, home);
          assert(false);
        } catch (e) {
          assert(e.message === 'forbidden');
        }
      });
      it('contributor cannot update published doc via actual update api', async function() {
        const req = apos.task.getContributorReq();
        const home = await apos.page.find(req, { slug: '/' }).toObject();
        assert(home);
        try {
          home.title = 'Contributor Updated';
          await apos.page.update(req, home);
          assert(false);
        } catch (e) {
          assert(e.message === 'forbidden');
        }
      });
      it('contributor can update draft doc via actual update api', async function() {
        const req = apos.task.getContributorReq({
          mode: 'draft'
        });
        const home = await apos.page.find(req, { slug: '/' }).toObject();
        assert(home);
        home.title = 'Contributor Updated';
        const updated = await apos.page.update(req, home);
        assert(updated.title === 'Contributor Updated');
      });
      it('contributor cannot publish doc', async function() {
        const req = apos.task.getContributorReq({
          mode: 'draft'
        });
        const home = await apos.page.find(req, { slug: '/' }).toObject();
        assert(home);
        try {
          await apos.page.publish(req, home);
          assert(false);
        } catch (e) {
          assert(e.message === 'forbidden');
        }
      });
      it('editor can publish doc', async function() {
        const req = apos.task.getEditorReq({
          mode: 'draft'
        });
        const home = await apos.page.find(req, { slug: '/' }).toObject();
        assert(home);
        await apos.page.publish(req, home);
        const pReq = apos.task.getEditorReq();
        const pHome = await apos.page.find(pReq, { slug: '/' }).toObject();
        assert(pHome.title === 'Contributor Updated');
      });
      it('editor can update published doc via actual update api', async function() {
        const req = apos.task.getEditorReq();
        const home = await apos.page.find(req, { slug: '/' }).toObject();
        assert(home);
        home.title = 'Editor Updated';
        const updated = await apos.page.update(req, home);
        assert(updated.title === 'Editor Updated');
      });
      it('admin can update via actual update api', async function() {
        const req = apos.task.getAdminReq();
        const home = await apos.page.find(req, { slug: '/' }).toObject();
        assert(home);
        home.visibility = 'loginRequired';
        await apos.page.update(req, home);
      });
      it('public cannot access when visibility is loginRequired', async function() {
        const anonReq = apos.task.getAnonReq();
        const home = await apos.page.find(anonReq, { slug: '/' }).toObject();
        assert(!home);
      });
      it('guest can access when visibility is loginRequired', async function() {
        const guestReq = apos.task.getGuestReq();
        const home = await apos.page.find(guestReq, { slug: '/' }).toObject();
        assert(home);
      });
      it('Allows the editor to create by type', function() {
        assert(apos.permission.can(
          apos.task.getEditorReq(), 'create', '@apostrophecms/home-page')
        );
      });
      it('Forbids the contributor to create by type', function() {
        assert(!apos.permission.can(
          apos.task.getContributorReq(), 'create', '@apostrophecms/home-page')
        );
      });
      it('Allows the contributor to delete a draft document', async function() {
        const contributor = apos.task.getContributorReq({ mode: 'draft' });
        const homeDraft = await apos.page.find(contributor, { slug: '/' }).toObject();

        const actual = apos.permission.can(contributor, 'delete', homeDraft);
        const expected = true;
        assert.deepEqual(actual, expected);
      });
      it('Forbids the contributor to delete a published document', async function() {
        const contributor = apos.task.getContributorReq();
        const home = await apos.page.find(contributor, { slug: '/' }).toObject();

        const actual = apos.permission.can(contributor, 'delete', home);
        const expected = false;
        assert.deepEqual(actual, expected);
      });
    });

    describe('criteria', function () {
      it('it should return the same criteria for edit, create and delete for editor', function () {
        const editor = apos.task.getEditorReq();

        const actual = {
          edit: apos.permission.criteria(editor, 'edit'),
          create: apos.permission.criteria(editor, 'create'),
          delete: apos.permission.criteria(editor, 'delete')
        };

        const expectedCriteria = { type: { $nin: [ '@apostrophecms/user' ] } };
        const expected = {
          edit: expectedCriteria,
          create: expectedCriteria,
          delete: expectedCriteria
        };

        assert.deepEqual(actual, expected);
      });
      it('it should return the same criteria for edit, create and delete for contributor', function () {
        const contributor = apos.task.getContributorReq();
        const expectedCriteria = {
          aposMode: { $in: [ null, 'draft' ] },
          type: {
            $nin: [
              '@apostrophecms/user',
              '@apostrophecms/image',
              '@apostrophecms/image-tag',
              '@apostrophecms/file',
              '@apostrophecms/file-tag'
            ]
          }
        };

        const actual = {
          edit: apos.permission.criteria(contributor, 'edit'),
          create: apos.permission.criteria(contributor, 'create'),
          delete: apos.permission.criteria(contributor, 'delete')
        };

        const expected = {
          edit: expectedCriteria,
          create: expectedCriteria,
          delete: expectedCriteria
        };

        assert.deepEqual(actual, expected);
      });
    });
  });

  describe('apiRoutes', function() {
    const roles = [
      'admin',
      'editor',
      'contributor',
      'guest'
    ];
    let jar;

    before(async function() {
      await t.createAdmin(apos);
      jar = await t.getUserJar(apos);
    });

    describe('GET', function() {
      describe('grid', function() {
        roles.forEach(role => {
          it(`should return the right permission sets for "${role}" role`, async function() {
            const { permissionSets } = await apos.http.get(`${apos.permission.action}/grid`, {
              qs: {
                role
              },
              jar
            });
            assert.deepEqual(permissionSets, expectedPermissionSetsByRole[role]);
          });
        });
      });
    });

    describe('POST', function() {
      describe('grid', function() {
        roles.forEach(role => {
          it(`should return the right permission sets for "${role}" role`, async function() {
            const { permissionSets } = await apos.http.post(`${apos.permission.action}/grid`, {
              body: {
                role
              },
              jar
            });
            assert.deepEqual(permissionSets, expectedPermissionSetsByRole[role]);
          });
        });
      });
    });
  });
});
