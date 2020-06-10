const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');

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
    assert(apos.permissions.__meta.name = '@apostrophecms/permissions');
  });

  // mock up a request
  function req(d) {
    const o = {
      traceIn: function() {},
      traceOut: function() {}
    };
    _.extend(o, d);
    return o;
  }

  describe('test permissions.can', function() {
    it('allows view-doc in the generic case', function() {
      assert(apos.permissions.can(req(), 'view-doc'));
    });
    it('rejects edit-doc in the generic case', function() {
      assert(!apos.permissions.can(req(), 'edit-doc'));
    });
    it('forbids view-doc for public with loginRequired', function() {
      assert(!apos.permissions.can(req(), 'view-doc', { published: true, loginRequired: 'loginRequired' }));
    });
    it('permits view-doc for public without loginRequired', function() {
      assert(apos.permissions.can(req(), 'view-doc', { published: true }));
    });
    it('prohibits view-doc for public without published', function() {
      assert(!apos.permissions.can(req(), 'view-doc', {}));
    });
    it('prohibits view-doc for public with loginRequired', function() {
      assert(!apos.permissions.can(req(), 'view-doc', { published: true, loginRequired: 'loginRequired' }));
    });
    it('permits view-doc for guest user with loginRequired', function() {
      assert(apos.permissions.can(req({ user: { _permissions: { guest: 1 } } }), 'view-doc', { published: true, loginRequired: 'loginRequired' }));
    });
    it('permits view-doc for individual with proper id', function() {
      assert(apos.permissions.can(req({ user: { _id: 1 } }), 'view-doc', { published: true, loginRequired: 'certainUsers', docPermissions: [ 'view-1' ] }));
    });
    it('forbids view-doc for individual with wrong id', function() {
      assert(!apos.permissions.can(req({ user: { _id: 2 } }), 'view-doc', { published: true, loginRequired: 'certainUsers', docPermissions: [ 'view-1' ] }));
    });
    it('permits view-doc for individual with group id', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ] } }), 'view-doc', { published: true, loginRequired: 'certainUsers', docPermissions: [ 'view-1002' ] }));
    });
    it('forbids view-doc for individual with wrong group id', function() {
      assert(!apos.permissions.can(req({ user: { _id: 2, groupIds: [ 1001, 1002 ] } }), 'view-doc', { published: true, loginRequired: 'certainUsers', docPermissions: [ 'view-1003' ] }));
    });
    it('certainUsers will not let you slide past to an unpublished doc', function() {
      assert(!apos.permissions.can(req({ user: { _id: 1 } }), 'view-doc', { loginRequired: 'certainUsers', docPermissions: [ 'view-1' ] }));
    });
    it('permits view-doc for unpublished doc for individual with group id for editing', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ] } }), 'view-doc', { docPermissions: [ 'edit-1002' ] }));
    });
    it('permits edit-doc for individual with group id for editing and the edit permission', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], _permissions: { edit: true } } }), 'edit-doc', { docPermissions: [ 'edit-1002' ] }));
    });
    it('forbids edit-doc for individual with group id for editing but no edit permission', function() {
      assert(!apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ] } }), 'edit-doc', { docPermissions: [ 'edit-1002' ] }));
    });
    it('permits edit-doc for individual with group id for managing and edit permission', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], _permissions: { edit: true } } }), 'edit-doc', { docPermissions: [ 'edit-1002' ] }));
    });
    it('forbids edit-doc for other person', function() {
      assert(!apos.permissions.can(req({ user: { _id: 7 } }), 'edit-doc', { docPermissions: [ 'edit-1002' ] }));
    });
  });
});
