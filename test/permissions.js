var assert = require('assert');
var _ = require('lodash');

describe('Permissions', function() {
  var apos;

  it('should have a permissions property', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      modules: {},
      afterInit: function(callback) {
        assert(apos.permissions);
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        // assert(!err);
        done();
      }
    });
  });


  function find(a, b) {
    for (var i in a) {
      if (b(a[i])) {
        return a[i];
      }
    }
  }

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
    it('allows view-page in the generic case', function() {
      assert(apos.permissions.can(req(), 'view-page'));
    });
    it('rejects edit-page in the generic case', function() {
      assert(!apos.permissions.can(req(), 'edit-page'));
    });
    it('forbids view-page for public with loginRequired', function() {
      assert(!apos.permissions.can(req(), 'view-page', { published: true, loginRequired: 'loginRequired' }));
    });
    it('permits view-page for public without loginRequired', function() {
      assert(apos.permissions.can(req(), 'view-page', { published: true }));
    });
    it('prohibits view-page for public without published', function() {
      assert(!apos.permissions.can(req(), 'view-page', {}));
    });
    it('prohibits view-page for public with loginRequired', function() {
      assert(!apos.permissions.can(req(), 'view-page', { published: true, loginRequired: 'loginRequired' }));
    });
    it('permits view-page for guest user with loginRequired', function() {
      assert(apos.permissions.can(req({ user: { permissions: { guest: 1 } } }), 'view-page', { published: true, loginRequired: 'loginRequired' }));
    });
    it('permits view-page for individual with proper id', function() {
      assert(apos.permissions.can(req({ user: { _id: 1 } }), 'view-page', { published: true, loginRequired: 'certainPeople', pagePermissions: [ 'view-1' ] }));
    });
    it('forbids view-page for individual with wrong id', function() {
      assert(!apos.permissions.can(req({ user: { _id: 2 } }), 'view-page', { published: true, loginRequired: 'certainPeople', pagePermissions: [ 'view-1' ] }));
    });
    it('permits view-page for individual with group id', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ] } }), 'view-page', { published: true, loginRequired: 'certainPeople', pagePermissions: [ 'view-1002' ] }));
    });
    it('forbids view-page for individual with wrong group id', function() {
      assert(!apos.permissions.can(req({ user: { _id: 2, groupIds: [ 1001, 1002 ] } }), 'view-page', { published: true, loginRequired: 'certainPeople', pagePermissions: [ 'view-1003' ] }));
    });
    it('certainPeople will not let you slide past to an unpublished page', function() {
      assert(!apos.permissions.can(req({ user: { _id: 1 } }), 'view-page', {  loginRequired: 'certainPeople', pagePermissions: [ 'view-1' ] }));
    });
    it('permits view-page for unpublished page for individual with group id for editing', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ] } }), 'view-page', { pagePermissions: [ 'edit-1002' ] }));
    });
    it('permits edit-page for individual with group id for editing and the edit permission', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], permissions: { edit: true } } }), 'edit-page', { pagePermissions: [ 'edit-1002' ] }));
    });
    it('forbids edit-page for individual with group id for editing but no edit permission', function() {
      assert(!apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ] } }), 'edit-page', { pagePermissions: [ 'edit-1002' ] }));
    });
    it('permits edit-page for individual with group id for managing and edit permission', function() {
      assert(apos.permissions.can(req({ user: { _id: 1, groupIds: [ 1001, 1002 ], permissions: { edit: true } } }), 'edit-page', { pagePermissions: [ 'publish-1002' ] }));
    });
    it('forbids edit-page for other person', function() {
      assert(!apos.permissions.can(req({ user: { _id: 7 } }), 'edit-page', { pagePermissions: [ 'publish-1002' ] }));
    });
  });

  // TODO uncomment these tests once apostrophe-pages (or apostrophe-documents)
  // becomes real
  
  // describe('test permissions.criteria', function() {
  //   it('successfully inserted test data', function(done) {
  //     return apos.pages.insert([
  //       {
  //         _id: 'page-1',
  //         slug: 'page-1',
  //         published: true
  //       },
  //       {
  //         _id: 'page-2',
  //         slug: 'page-2',
  //       },
  //       {
  //         _id: 'page-3',
  //         slug: 'page-3',
  //         published: true,
  //         loginRequired: 'loginRequired'
  //       },
  //       {
  //         _id: 'page-4',
  //         slug: 'page-4',
  //         published: true,
  //         loginRequired: 'certainPeople',
  //         pagePermissions: [ 'view-1' ]
  //       },
  //       {
  //         _id: 'page-5',
  //         slug: 'page-5',
  //         loginRequired: 'certainPeople',
  //         pagePermissions: [ 'view-1' ]
  //       },
  //       {
  //         _id: 'page-6',
  //         slug: 'page-6',
  //         published: true,
  //         loginRequired: 'certainPeople',
  //         pagePermissions: [ 'view-1002' ]
  //       },
  //       {
  //         _id: 'page-7',
  //         slug: 'page-7',
  //         pagePermissions: [ 'edit-1002' ]
  //       },
  //       {
  //         _id: 'page-8',
  //         slug: 'page-8',
  //         pagePermissions: [ 'publish-1002' ]
  //       }
  //     ], function(err, count) {
  //       assert(!err);
  //       done();
  //     });
  //   });

  //   var err;
  //   var results;
  //   it('public user queries without error', function(done) {
  //     return apos.pages.find(apos.permissions.criteria(req({}), 'view-page')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('forbids view-page for public with loginRequired', function() {
  //     assert(!find(results, function(result) {
  //       return !!result.loginRequired;
  //     }));
  //   });
  //   it('allows public view-page without loginRequired', function() {
  //     assert(find(results, function(result) {
  //       return !result.loginRequired;
  //     }));
  //   });
  //   it('prohibits view-page for public without published', function() {
  //     assert(!find(results, function(result) {
  //       return !result.published;
  //     }));
  //   });

  //   it('guest user queries without error', function(done) {
  //     return apos.pages.find(apos.permissions.criteria(req({ user: { permissions: { guest: 1 } } }), 'view-page')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('permits view-page for guest user with loginRequired', function() {
  //     assert(find(results, function(result) {
  //       return result.loginRequired === 'loginRequired';
  //     }));
  //   });

  //   it('id 1 user queries without error', function(done) {
  //     return apos.pages.find(apos.permissions.criteria(req({ user: { _id: 1 } }), 'view-page')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('permits view-page for individual with proper id', function() {
  //     assert(find(results, function(result) {
  //       return (result.loginRequired === 'certainPeople') && result.pagePermissions && (result.pagePermissions.length === 1) && (result.pagePermissions[0] === 'view-1');
  //     }));
  //   });
  //   it('certainPeople will not let you slide past to an unpublished page', function() {
  //     assert(!find(results, function(result) {
  //       return (result.loginRequired === 'certainPeople') && (result.pagePermissions.length === 1) && (result.pagePermissions[0] === 'view-1') && (!result.published);
  //     }));
  //   });

  //   it('id 2 user queries without error', function(done) {
  //     return apos.pages.find(apos.permissions.criteria(req({ user: { _id: 2 } }), 'view-page')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('forbids view-page for individual with wrong id', function() {
  //     assert(!find(results, function(result) {
  //       return (result.loginRequired === 'certainPeople') && result.pagePermissions && (result.pagePermissions.length === 1) && (result.pagePermissions[0] === 'view-1');
  //     }));
  //   });

  //   it('group 1002 user queries without error', function(done) {
  //     return apos.pages.find(apos.permissions.criteria(req({ user: { _id: 3, groupIds: [ 1002 ] } }), 'view-page')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('permits view-page for individual with proper group id', function() {
  //     assert(find(results, function(result) {
  //       return (result.loginRequired === 'certainPeople') && result.pagePermissions && (find(result.pagePermissions, function(p) { return p === 'view-1002'; }));
  //     }));
  //   });

  //   it('permits view-page for unpublished page for individual with group id for editing', function() {
  //     assert(find(results, function(result) {
  //       return (result.loginRequired !== 'certainPeople') && result.pagePermissions && (find(result.pagePermissions, function(p) { return p === 'edit-1002'; }));
  //     }));
  //   });

  //   it('group 1003 user queries without error', function(done) {
  //     return apos.pages.find(apos.permissions.criteria(req({ user: { _id: 3, groupIds: [ 1003 ] } }), 'view-page')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('forbids view-page for individual with wrong group id', function() {
  //     assert(!find(results, function(result) {
  //       return (result.loginRequired === 'certainPeople') && result.pagePermissions && (find(result.pagePermissions, function(p) { return p === 'view-1002'; }));
  //     }));
  //   });

  //   it('group 1002 user queries for editing without error', function(done) {
  //     return apos.pages.find(apos.permissions.criteria(req({ user: { _id: 3, groupIds: [ 1002 ], permissions: { edit: true } } }), 'edit-page')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('permits edit-page for individual with group id for editing', function() {
  //     assert(find(results, function(result) {
  //       return (result.pagePermissions && find(result.pagePermissions, function(p) { return p === 'edit-1002'; }));
  //     }));
  //   });

  //   it('permits edit-page for individual with group id for editing', function() {
  //     assert(find(results, function(result) {
  //       return (result.pagePermissions && find(result.pagePermissions, function(p) { return p === 'edit-1002'; }));
  //     }));
  //   });

  //   it('permits edit-page for individual with group id for managing', function() {
  //     assert(find(results, function(result) {
  //       return (result.pagePermissions && find(result.pagePermissions, function(p) { return p === 'publish-1002'; }));
  //     }));
  //   });

  //   it('other user queries for editing without error', function(done) {
  //     return apos.pages.find(apos.permissions.criteria(req({ user: { _id: 7 } }), 'edit-page')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('forbids edit-page for other person', function() {
  //     assert(!results.length);
  //   });

  //   it('appropriate user can add area to page-1 with putArea without error', function(done) {
  //     return apos.putArea(req({ user: { permissions: { admin: 1 } } }), 'page-1:test', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
  //       assert(!err);
  //       done();
  //     });
  //   });
  //   it('the area actually gets there', function(done) {
  //     return apos.getPage(req({ user: { permissions: { admin: 1 } } }), 'page-1', function(err, page) {
  //       assert(!err);
  //       assert(page);
  //       assert(page.test);
  //       assert(page.test.items[0]);
  //       assert(page.test.items[0].content === '<h4>Whee</h4>');
  //       done();
  //     });
  //   });
  //   it('inappropriate user cannot add area to page-1 with putArea', function(done) {
  //     return apos.putArea(req({ user: { permissions: { guest: 1 } } }), 'page-1:test', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
  //       assert(err);
  //       done();
  //     });
  //   });
  //   it('appropriate user can make new page with putArea without error', function(done) {
  //     return apos.putArea(req({ user: { permissions: { admin: 1 } } }), 'global:test', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
  //       assert(!err);
  //       done();
  //     });
  //   });
  //   it('an area on a new page actually gets there', function(done) {
  //     return apos.getPage(req({ user: { permissions: { admin: 1 } } }), 'global', function(err, page) {
  //       assert(!err);
  //       assert(page);
  //       assert(page.test);
  //       assert(page.test.items[0]);
  //       assert(page.test.items[0].content === '<h4>Whee</h4>');
  //       done();
  //     });
  //   });
  //   it('can add a second area to that new page', function(done) {
  //     return apos.putArea(req({ user: { permissions: { admin: 1 } } }), 'global:test2', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
  //       assert(!err);
  //       done();
  //     });
  //   });
  //   it('second area does not blow out the first', function(done) {
  //     return apos.getPage(req({ user: { permissions: { admin: 1 } } }), 'global', function(err, page) {
  //       assert(!err);
  //       assert(page);
  //       assert(page.test);
  //       assert(page.test.items[0]);
  //       assert(page.test.items[0].content === '<h4>Whee</h4>');
  //       done();
  //     });
  //   });
  //   it('even an admin cannot make a new page with putArea if the slug starts with /', function(done) {
  //     return apos.putArea(req({ user: { permissions: { admin: 1 } } }), '/:test', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
  //       assert(err);
  //       done();
  //     });
  //   });
  // });
});