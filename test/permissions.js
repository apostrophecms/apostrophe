const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Permissions', function() {
  this.timeout(t.timeout);

  let apos;

  after(function() {
    return t.destroy(apos);
  });

  it('should have a permissions property', async function() {
    apos = await t.create({
      root: module
    });
    assert(apos.permission.__meta.name = '@apostrophecms/permission');
  });

  describe('test permissions.can', function() {
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
    it('allows the public to view a particular doc via criteria and via can()', async () => {
      const req = apos.task.getAnonReq();
      const home = await apos.page.find(req, { slug: '/' }).toObject();
      assert(home);
      assert(apos.permission.can(apos.task.getAnonReq(), 'view', home));
    });
    it('public cannot update via actual update api', async () => {
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
    it('contributor cannot update published doc via actual update api', async () => {
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
    it('contributor can update draft doc via actual update api', async () => {
      const req = apos.task.getContributorReq({
        mode: 'draft'
      });
      const home = await apos.page.find(req, { slug: '/' }).toObject();
      assert(home);
      home.title = 'Contributor Updated';
      const updated = await apos.page.update(req, home);
      assert(updated.title === 'Contributor Updated');
    });
    it('contributor cannot publish doc', async () => {
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
    it('editor can publish doc', async () => {
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
    it('editor can update published doc via actual update api', async () => {
      const req = apos.task.getEditorReq();
      const home = await apos.page.find(req, { slug: '/' }).toObject();
      assert(home);
      home.title = 'Editor Updated';
      const updated = await apos.page.update(req, home);
      assert(updated.title === 'Editor Updated');
    });
    it('admin can update via actual update api', async () => {
      const req = apos.task.getAdminReq();
      const home = await apos.page.find(req, { slug: '/' }).toObject();
      assert(home);
      home.visibility = 'loginRequired';
      await apos.page.update(req, home);
    });
    it('public cannot access when visibility is loginRequired', async () => {
      const anonReq = apos.task.getAnonReq();
      const home = await apos.page.find(anonReq, { slug: '/' }).toObject();
      assert(!home);
    });
    it('guest can access when visibility is loginRequired', async () => {
      const guestReq = apos.task.getGuestReq();
      const home = await apos.page.find(guestReq, { slug: '/' }).toObject();
      assert(home);
    });
  });
});
