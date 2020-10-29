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
      assert(apos.permission.can(apos.task.getReq(), 'view', '@apostrophecms/home-page'));
    });
    it('Forbids the public to update by type', function() {
      assert(!apos.permission.can(apos.task.getAnonReq(), 'edit', '@apostrophecms/home-page'));
    });
    it('Allows the admin to update by type', function() {
      assert(apos.permission.can(apos.task.getReq(), 'edit', '@apostrophecms/home-page'));
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
      } catch (e) {
        assert(e.message === 'forbidden');
      }
    });
    it('admin can update via actual update api', async () => {
      const req = apos.task.getReq();
      const home = await apos.page.find(req, { slug: '/' }).toObject();
      assert(home);
      home.visibility = 'loginRequired';
      await apos.page.update(req, home);
    });
    it('public cannot access when visibility is loginRequired', async () => {
      const anonReq = apos.task.getAnonReq();
      try {
        const home = await apos.page.find(anonReq, { slug: '/' }).toObject();
        assert(!home);
      } catch (e) {
        assert(e.message === 'forbidden');
      }
    });
  });
});
