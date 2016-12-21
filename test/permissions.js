var assert = require('assert');
var _ = require('lodash');

describe('Permissions', function() {

  this.timeout(5000);

  var apos;

  it('should have a permissions property', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
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
      assert(!apos.permissions.can(req({ user: { _id: 1 } }), 'view-doc', {  loginRequired: 'certainUsers', docPermissions: [ 'view-1' ] }));
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

  // TODO uncomment these tests once apostrophe-docs (or apostrophe-documents)
  // becomes real

  // describe('test permissions.criteria', function() {
  //   it('successfully inserted test data', function(done) {
  //     return apos.docs.insert([
  //       {
  //         _id: 'doc-1',
  //         slug: 'doc-1',
  //         published: true
  //       },
  //       {
  //         _id: 'doc-2',
  //         slug: 'doc-2',
  //       },
  //       {
  //         _id: 'doc-3',
  //         slug: 'doc-3',
  //         published: true,
  //         loginRequired: 'loginRequired'
  //       },
  //       {
  //         _id: 'doc-4',
  //         slug: 'doc-4',
  //         published: true,
  //         loginRequired: 'certainUsers',
  //         docPermissions: [ 'view-1' ]
  //       },
  //       {
  //         _id: 'doc-5',
  //         slug: 'doc-5',
  //         loginRequired: 'certainUsers',
  //         docPermissions: [ 'view-1' ]
  //       },
  //       {
  //         _id: 'doc-6',
  //         slug: 'doc-6',
  //         published: true,
  //         loginRequired: 'certainUsers',
  //         docPermissions: [ 'view-1002' ]
  //       },
  //       {
  //         _id: 'doc-7',
  //         slug: 'doc-7',
  //         docPermissions: [ 'edit-1002' ]
  //       },
  //       {
  //         _id: 'doc-8',
  //         slug: 'doc-8',
  //         docPermissions: [ 'publish-1002' ]
  //       }
  //     ], function(err, count) {
  //       assert(!err);
  //       done();
  //     });
  //   });

  //   var err;
  //   var results;
  //   it('public user queries without error', function(done) {
  //     return apos.docs.find(apos.permissions.criteria(req({}), 'view-doc')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('forbids view-doc for public with loginRequired', function() {
  //     assert(!find(results, function(result) {
  //       return !!result.loginRequired;
  //     }));
  //   });
  //   it('allows public view-doc without loginRequired', function() {
  //     assert(find(results, function(result) {
  //       return !result.loginRequired;
  //     }));
  //   });
  //   it('prohibits view-doc for public without published', function() {
  //     assert(!find(results, function(result) {
  //       return !result.published;
  //     }));
  //   });

  //   it('guest user queries without error', function(done) {
  //     return apos.docs.find(apos.permissions.criteria(req({ user: { permissions: { guest: 1 } } }), 'view-doc')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('permits view-doc for guest user with loginRequired', function() {
  //     assert(find(results, function(result) {
  //       return result.loginRequired === 'loginRequired';
  //     }));
  //   });

  //   it('id 1 user queries without error', function(done) {
  //     return apos.docs.find(apos.permissions.criteria(req({ user: { _id: 1 } }), 'view-doc')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('permits view-doc for individual with proper id', function() {
  //     assert(find(results, function(result) {
  //       return (result.loginRequired === 'certainUsers') && result.docPermissions && (result.docPermissions.length === 1) && (result.docPermissions[0] === 'view-1');
  //     }));
  //   });
  //   it('certainUsers will not let you slide past to an unpublished doc', function() {
  //     assert(!find(results, function(result) {
  //       return (result.loginRequired === 'certainUsers') && (result.docPermissions.length === 1) && (result.docPermissions[0] === 'view-1') && (!result.published);
  //     }));
  //   });

  //   it('id 2 user queries without error', function(done) {
  //     return apos.docs.find(apos.permissions.criteria(req({ user: { _id: 2 } }), 'view-doc')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('forbids view-doc for individual with wrong id', function() {
  //     assert(!find(results, function(result) {
  //       return (result.loginRequired === 'certainUsers') && result.docPermissions && (result.docPermissions.length === 1) && (result.docPermissions[0] === 'view-1');
  //     }));
  //   });

  //   it('group 1002 user queries without error', function(done) {
  //     return apos.docs.find(apos.permissions.criteria(req({ user: { _id: 3, groupIds: [ 1002 ] } }), 'view-doc')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('permits view-doc for individual with proper group id', function() {
  //     assert(find(results, function(result) {
  //       return (result.loginRequired === 'certainUsers') && result.docPermissions && (find(result.docPermissions, function(p) { return p === 'view-1002'; }));
  //     }));
  //   });

  //   it('permits view-doc for unpublished doc for individual with group id for editing', function() {
  //     assert(find(results, function(result) {
  //       return (result.loginRequired !== 'certainUsers') && result.docPermissions && (find(result.docPermissions, function(p) { return p === 'edit-1002'; }));
  //     }));
  //   });

  //   it('group 1003 user queries without error', function(done) {
  //     return apos.docs.find(apos.permissions.criteria(req({ user: { _id: 3, groupIds: [ 1003 ] } }), 'view-doc')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('forbids view-doc for individual with wrong group id', function() {
  //     assert(!find(results, function(result) {
  //       return (result.loginRequired === 'certainUsers') && result.docPermissions && (find(result.docPermissions, function(p) { return p === 'view-1002'; }));
  //     }));
  //   });

  //   it('group 1002 user queries for editing without error', function(done) {
  //     return apos.docs.find(apos.permissions.criteria(req({ user: { _id: 3, groupIds: [ 1002 ], permissions: { edit: true } } }), 'edit-doc')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('permits edit-doc for individual with group id for editing', function() {
  //     assert(find(results, function(result) {
  //       return (result.docPermissions && find(result.docPermissions, function(p) { return p === 'edit-1002'; }));
  //     }));
  //   });

  //   it('permits edit-doc for individual with group id for editing', function() {
  //     assert(find(results, function(result) {
  //       return (result.docPermissions && find(result.docPermissions, function(p) { return p === 'edit-1002'; }));
  //     }));
  //   });

  //   it('permits edit-doc for individual with group id for managing', function() {
  //     assert(find(results, function(result) {
  //       return (result.docPermissions && find(result.docPermissions, function(p) { return p === 'publish-1002'; }));
  //     }));
  //   });

  //   it('other user queries for editing without error', function(done) {
  //     return apos.docs.find(apos.permissions.criteria(req({ user: { _id: 7 } }), 'edit-doc')).toArray(function(_err, _results) {
  //       err = _err;
  //       assert(!err);
  //       results = _results;
  //       assert(Array.isArray(results));
  //       done();
  //     });
  //   });

  //   it('forbids edit-doc for other person', function() {
  //     assert(!results.length);
  //   });

  //   it('appropriate user can add area to doc-1 with putArea without error', function(done) {
  //     return apos.putArea(req({ user: { permissions: { admin: 1 } } }), 'doc-1:test', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
  //       assert(!err);
  //       done();
  //     });
  //   });
  //   it('the area actually gets there', function(done) {
  //     return apos.getdoc(req({ user: { permissions: { admin: 1 } } }), 'doc-1', function(err, doc) {
  //       assert(!err);
  //       assert(doc);
  //       assert(doc.test);
  //       assert(doc.test.items[0]);
  //       assert(doc.test.items[0].content === '<h4>Whee</h4>');
  //       done();
  //     });
  //   });
  //   it('inappropriate user cannot add area to doc-1 with putArea', function(done) {
  //     return apos.putArea(req({ user: { permissions: { guest: 1 } } }), 'doc-1:test', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
  //       assert(err);
  //       done();
  //     });
  //   });
  //   it('appropriate user can make new doc with putArea without error', function(done) {
  //     return apos.putArea(req({ user: { permissions: { admin: 1 } } }), 'global:test', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
  //       assert(!err);
  //       done();
  //     });
  //   });
  //   it('an area on a new doc actually gets there', function(done) {
  //     return apos.getdoc(req({ user: { permissions: { admin: 1 } } }), 'global', function(err, doc) {
  //       assert(!err);
  //       assert(doc);
  //       assert(doc.test);
  //       assert(doc.test.items[0]);
  //       assert(doc.test.items[0].content === '<h4>Whee</h4>');
  //       done();
  //     });
  //   });
  //   it('can add a second area to that new doc', function(done) {
  //     return apos.putArea(req({ user: { permissions: { admin: 1 } } }), 'global:test2', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
  //       assert(!err);
  //       done();
  //     });
  //   });
  //   it('second area does not blow out the first', function(done) {
  //     return apos.getdoc(req({ user: { permissions: { admin: 1 } } }), 'global', function(err, doc) {
  //       assert(!err);
  //       assert(doc);
  //       assert(doc.test);
  //       assert(doc.test.items[0]);
  //       assert(doc.test.items[0].content === '<h4>Whee</h4>');
  //       done();
  //     });
  //   });
  //   it('even an admin cannot make a new doc with putArea if the slug starts with /', function(done) {
  //     return apos.putArea(req({ user: { permissions: { admin: 1 } } }), '/:test', { type: 'area', items: [ { type: 'richText', content: '<h4>Whee</h4>' } ] }, function(err) {
  //       assert(err);
  //       done();
  //     });
  //   });
  // });
});
