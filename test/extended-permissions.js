var t = require('../test-lib/test.js');
var assert = require('assert');
var _ = require('@sailshq/lodash');

describe('Extended Permissions', function() {

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
        },
        'apostrophe-permissions': {
          extended: true
        },
        'turkeys': {
          extend: 'apostrophe-pieces',
          name: 'turkey'
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
    const req = apos.tasks.getAnonReq();
    _.extend(req, d);
    return req;
  }

  describe('test permissions.can', function() {
    it('allows view-doc in the generic case', function() {
      assert(apos.permissions.can(req(), 'view-doc'));
    });
    it('rejects insert-doc in the generic case', function() {
      assert(!apos.permissions.can(req(), 'insert-doc'));
    });
    it('rejects update-doc in the generic case', function() {
      assert(!apos.permissions.can(req(), 'update-doc'));
    });
    it('rejects trash-doc in the generic case', function() {
      assert(!apos.permissions.can(req(), 'trash-doc'));
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
    it('permits view-doc for unpublished doc for individual with group id for editing and the update permission for the type', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], _permissions: { 'update-turkey': true } } }), 'view-doc', { type: 'turkey', docPermissions: [ 'edit-1002' ] }));
    });
    it('permits view-doc for unpublished doc for individual with the updateany permission for the type', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, _permissions: { 'updateany-turkey': true } } }), 'view-doc', { type: 'turkey', docPermissions: [ 'edit-1002' ] }));
    });
    it('permits insert-doc for individual with the insert permission', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, _permissions: { 'insert-turkey': true } } }), 'insert-turkey'));
    });
    it('forbids insert-doc for individual without the insert permission', function() {
      assert(!apos.permissions.can(req({ user: { _id: 1, _permissions: {} } }), 'insert-turkey'));
    });
    it('permits update-doc for individual with the updateany permission', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, _permissions: { 'updateany-turkey': true } } }), 'update-doc', { type: 'turkey', docPermissions: [ 'edit-1002' ] }));
    });
    it('permits update-doc for individual with group id for edit- and the update-turkey permission', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], _permissions: { 'update-turkey': true } } }), 'update-doc', { type: 'turkey', docPermissions: [ 'edit-1002' ] }));
    });
    it('forbids update-doc for individual with group id for editing but no update-turkey permission', function() {
      assert(!apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ] } }), 'update-doc', { docPermissions: [ 'edit-1002' ] }));
    });
    it('forbids update-doc for other person', function() {
      assert(!apos.permissions.can(req({ user: { _id: 7 } }), 'update-doc', { docPermissions: [ 'edit-1002' ] }));
    });
    it('permits trash-doc for individual with update permission for the doc and the trash permission for turkeys', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], _permissions: { 'update-turkey': true, 'trash-turkey': true } } }), 'trash-doc', { type: 'turkey', docPermissions: [ 'edit-1002' ] }));
    });
    it('forbids trash-doc for individual with update permission for the doc but no trash permission for turkeys', function() {
      assert(!apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], _permissions: { 'update-turkey': true } } }), 'trash-doc', { type: 'turkey', docPermissions: [ 'edit-1002' ] }));
    });
    it('can insert test turkey objects for criteria tests', function() {
      return apos.docs.db.insert([
        {
          _id: 'published',
          slug: 'published',
          type: 'turkey',
          published: true
        },
        {
          _id: 'unpublished',
          slug: 'unpublished',
          type: 'turkey',
          published: false
        },
        {
          _id: 'loginrequired',
          slug: 'loginrequired',
          type: 'turkey',
          published: true,
          loginRequired: 'loginRequired'
        },
        {
          _id: 'certainusers',
          slug: 'certainusers',
          type: 'turkey',
          published: true,
          loginRequired: 'certainUsers',
          docPermissions: [ 'view-1' ]
        },
        {
          _id: 'certainusersendrun',
          slug: 'certainusersendrun',
          type: 'turkey',
          published: false,
          loginRequired: 'certainUsers',
          docPermissions: [ 'view-1' ]
        },
        {
          _id: 'certainusersgroup',
          slug: 'certainusersgroup',
          type: 'turkey',
          published: true,
          loginRequired: 'certainUsers',
          docPermissions: [ 'view-1002' ]
        },
        {
          _id: 'edit1002',
          slug: 'edit1002',
          type: 'turkey',
          docPermissions: [ 'edit-1002' ]
        }
      ]).catch(function(e) {
        console.error(e);
        throw e;
      });
    });

    it('permits view-doc for public without loginRequired', function() {
      return criteriaTest(req(), 'view-doc', 'published', true);
    });
    it('prohibits view-doc for public without published', function() {
      return criteriaTest(req(), 'view-doc', 'unpublished', false);
    });
    it('prohibits view-doc for public with loginRequired', function() {
      return criteriaTest(req(), 'view-doc', 'loginrequired', false);
    });
    it('permits view-doc for guest user with loginRequired', function() {
      return criteriaTest(req({ user: { _id: 1, _permissions: { guest: true } } }), 'view-doc', 'loginrequired', true);
    });
    it('permits view-doc for individual with proper id', function() {
      return criteriaTest(req({ user: { _id: 1 } }), 'view-doc', 'certainusers', true);
    });
    it('forbids view-doc for individual with wrong id', function() {
      return criteriaTest(req({ user: { _id: 2 } }), 'view-doc', 'certainusers', false);
    });
    it('permits view-doc for individual with group id', function() {
      return criteriaTest(req({ user: { _id: 1, groupIds: [ 1001, 1002 ] } }), 'view-doc', 'certainusersgroup', true);
    });
    it('forbids view-doc for individual with wrong group id', function() {
      return criteriaTest(req({ user: { _id: 1, groupIds: [ 1003 ] } }), 'view-doc', 'certainusersgroup', false);
    });
    it('certainUsers will not let you slide past to an unpublished doc', function() {
      return criteriaTest(req({ user: { _id: 1 } }), 'view-doc', 'certainusersendrun', false);
    });
    it('permits view-doc for unpublished doc for individual with group id for editing and the update permission for the type', function() {
      return criteriaTest(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], _permissions: { 'update-turkey': true } } }), 'view-doc', 'edit1002', true);
    });
    it('permits view-doc for unpublished doc for individual with the updateany permission for the type', function() {
      return criteriaTest(req({ user: { _id: 1, _permissions: { 'updateany-turkey': true } } }), 'view-doc', 'edit1002', true);
    });
    it('permits update-doc for individual with the updateany permission', function() {
      return criteriaTest(req({ user: { _id: 1, _permissions: { 'updateany-turkey': true } } }), 'update-doc', 'edit1002', true);
    });
    it('permits update-doc for individual with group id for edit- and the update-turkey permission', function() {
      return criteriaTest(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], _permissions: { 'update-turkey': true } } }), 'update-doc', 'edit1002', true);
    });
    it('forbids update-doc for individual with group id for editing but no update-turkey permission', function() {
      return criteriaTest(req({ user: { _id: 1, groupIds: [ 1001, 1002 ] } }), 'update-doc', 'edit1002', false);
    });
    it('forbids update-doc for other person', function() {
      return criteriaTest(req({ user: { _id: 7 } }), 'update-doc', 'edit1002', false);
    });
    it('permits trash-doc for individual with update permission for the doc and the trash permission for turkeys', function() {
      return criteriaTest(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], _permissions: { 'update-turkey': true, 'trash-turkey': true } } }), 'trash-doc', 'edit1002', true);
    });
    it('forbids trash-doc for individual with update permission for the doc but no trash permission for turkeys', function() {
      return criteriaTest(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], _permissions: { 'update-turkey': true } } }), 'trash-doc', 'edit1002', false);
    });
    it('permits update-doc for an admin', function() {
      return criteriaTest(req({ user: { _id: 1, _permissions: { 'admin': true } } }), 'update-doc', 'edit1002', true);
    });
    it('forbids update-doc for individual with group id for edit- and the update-turkey permission if turkeys are adminOnly', function() {
      apos.modules.turkeys.options.adminOnly = true;
      return criteriaTest(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], _permissions: { 'update-turkey': true } } }), 'update-doc', 'edit1002', false);
    });
    it('still permits update-doc for an admin when turkeys are adminOnly', function() {
      return criteriaTest(req({ user: { _id: 1, _permissions: { 'admin': true } } }), 'update-doc', 'edit1002', true);
    });
    
    function criteriaTest(req, permission, _id, present) {
      // In order to test whether this user can access documents even if they are
      // unpublished or in the trash in certain circumstances, we must make sure we're
      // not using the default filters that would choose not to return those things anyway
      return apos.docs.find(req, { _id: _id }).permission(permission).published(null).trash(null).toObject().then(function(doc) {
        if (present) {
          assert(doc);
        } else {
          assert(!doc);
        }
      });
    }
  });
});
