var t = require('../test-lib/test.js');
var assert = require('assert');
var _ = require('@sailshq/lodash');

describe('Permissions', function() {

  this.timeout(t.timeout);

  var apos;

  after(function(done) {
    return t.destroy(apos, function() {
      return done();
    });
  });

  it('should have a permissions property', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900
        }
      },
      afterInit: function(callback) {
        assert(apos.permissions);
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  // mock up a request
  function req(d) {
    var o = {
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
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], _permissions: { edit: true } } }), 'edit-doc', { docPermissions: [ 'publish-1002' ] }));
    });
    it('forbids edit-doc for other person', function() {
      assert(!apos.permissions.can(req({ user: { _id: 7 } }), 'edit-doc', { docPermissions: [ 'publish-1002' ] }));
    });
  });
});
