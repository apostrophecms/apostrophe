var assert = require('assert');
var _ = require('lodash');
var async = require('async');

var apos;

function anonReq() {
  return {
    res: {
      __: function(x) { return x; }
    },
    browserCall: apos.app.request.browserCall,
    getBrowserCalls: apos.app.request.getBrowserCalls,
    query: {}
  };
}

function adminReq() {
  return _.merge(anonReq(), {
    user: {
      permissions: {
        admin: true
      }
    }
  });
}

describe('Pages', function() {
  //////
  // EXISTENCE
  //////

  it('should be a property of the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7940
        }
      },
      afterInit: function(callback) {
        assert(apos.pages);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        done();
      }
    });
  });


  //////
  // SETUP
  //////

  it('should make sure all of the expected indexes are configured', function(done){
    var expectedIndexes = ['path'];
    var actualIndexes = []

    apos.docs.db.indexInformation(function(err, info){
      assert(!err);

      // Extract the actual index info we care about
      _.each(info, function(index){
        actualIndexes.push(index[0][0]);
      });

      // Now make sure everything in expectedIndexes is in actualIndexes
      _.each(expectedIndexes, function(index){
        assert(_.contains(actualIndexes, index))
      });

      done();
    });
  });

  //TODO: come back and add the paths to clean up.
  it('should make sure there is no test data hanging around from last time', function(done){
    // Attempt to remove all the test people we know about
    apos.docs.db.remove({
      $or: [
        { type: 'testPage' }
      ]
    }, function(err){
      assert(!err);
      // Now look for one of them and make sure they don't exist anymore
      apos.pages.find(adminReq(), { slug: 'child' }).toArray(function(err, docs){
        assert(!err);
        assert(docs.length === 0);
        done();
      });
    });
  });

  it('should be able to use db to insert documents', function(done){
    var testItems = [
      { _id: '1234',
        type: 'testPage',
        slug: 'parent',
        published: true,
        path: '/root/parent',
        level: 1,
        rank: 0
      },
      {
        _id: '2341',
        type: 'testPage',
        slug: 'child',
        published: true,
        path: '/root/parent/child',
        level: 2,
        rank: 0
      },
      {
        _id: '3412',
        type: 'testPage',
        slug: 'root',
        published: true,
        path: '/root',
        level: 0,
        rank: 0
      },
      {
        _id: '4123',
        type: 'testPage',
        slug: 'grandchild',
        published: true,
        path: '/root/parent/child/grandchild',
        level: 3,
        rank: 0
      },
      {
        _id: '4321',
        type: 'testPage',
        slug: 'sibling',
        published: true,
        path: '/root/parent/sibling',
        level: 2,
        rank: 1

      },
      {
        _id: '4312',
        type: 'testPage',
        slug: 'cousin',
        published: true,
        path: '/root/parent/sibling/cousin',
        level: 3,
        rank: 0
      }
    ];

    apos.docs.db.insert(testItems, function(err){
      assert(!err);
      done();
    });

  });


  //////
  // FINDING
  //////

  it('should have a find method on pages that returns a cursor', function(){
    var cursor = apos.pages.find();
    assert(cursor);
  });


  it('should be able to find just a single page', function(done){
    var cursor = apos.pages.find(anonReq(), { slug: 'child' });

    cursor.toObject(function(err, page){
      assert(!err);
      // There should be only 1 result.
      assert(page);
      // It should have a path of /root/parent/child
      assert(page.path === '/root/parent/child');
      done();
    });
  });

  it('should be able to include the ancestors of a page', function(done){
    var cursor = apos.pages.find(anonReq(), { slug: 'child' });

    cursor.ancestors(true).toObject(function(err, page){
      assert(!err);
      // There should be only 1 result.
      assert(page);
      // There should be 2 ancestors.
      assert(page._ancestors.length === 2);
      // The first ancestor should be 'root'
      assert.equal(page._ancestors[0].path, '/root');
      // The second ancestor should be 'parent'
      assert.equal(page._ancestors[1].path, '/root/parent');
      done();
    });
  });

  it('should be able to include the children of the ancestors of a page', function(done){
    var cursor = apos.pages.find(anonReq(), { slug: 'child' });

    cursor.ancestors({children: 1}).toObject(function(err, page){
      assert(!err);
      // There should be only 1 result.
      assert(page);
      // There should be 2 ancestors.
      assert(page._ancestors.length === 2);
      // The second ancestor should have children
      assert(page._ancestors[1]._children);
      // The first ancestor's child should have a path '/root/parent/child'
      assert.equal(page._ancestors[1]._children[0].path, '/root/parent/child');
      // The second ancestor's child should have a path '/root/parent/sibling'
      assert.equal(page._ancestors[1]._children[1].path, '/root/parent/sibling');
      done();
    });
  });


  //////
  // INSERTING
  //////
  it('is able to insert a new page', function(done) {
    var parentId = '1234';

    var newPage = {
      slug: 'new-page',
      published: true,
      type: 'testPage',
      title: 'New Page'
    };
    apos.pages.insert(adminReq(), parentId, newPage, function(err, page){
      // did it return an error?
      assert(!err);
      //Is the path generally correct?
      assert.equal(page.path, '/root/parent/new-page');
      done();
    });
  });

  it('is able to insert a new page in the correct order', function(done) {
    var cursor = apos.pages.find(anonReq(), { slug: 'new-page' });

    cursor.toObject(function(err, page){
      assert.equal(page.rank, 2);
    })
  });

  //////
  // MOVING
  //////

  it('is able to move root/parent/sibling/cousin after root/parent', function(done) {
    // 'Cousin' _id === 4312
    // 'Parent' _id === 1234
    apos.pages.move(adminReq, '4312', '1234', 'after', function(err) {
      if (err) {
        console.log(err);
      }
      assert(!err);
    });

    var cursor = apos.pages.find(anonReq, {_id: '4312'});
    cursor.toObject(function(err, page){
      if (err) {
        console.log(err);
      }
      assert(!err);
      //Is the new path correct?
      assert.equal(page.path, '/root/cousin');
      //Is the rank correct?
      assert.equal(page.rank, 1);
      return done();
    });


  });

  it('is able to move root/cousin before root/parent/child', function(done) {
    // 'Cousin' _id === 4312
    // 'Child' _id === 2341
    apos.pages.move(adminReq, '4312', '2341', 'before', function(err) {
      if (err) {
        console.log(err);
      }
      assert(!err);
    });

    var cursor = apos.pages.find(anonReq, {_id: '4312'});
    cursor.toObject(function(err, page){
      if (err) {
        console.log(err);
      }
      assert(!err);
      //Is the new path correct?
      assert.equal(page.path, '/root/parent/cousin');
      //Is the rank correct?
      assert.equal(page.rank, 0);
      return done();
    });
  });


  it('is able to move root/parent/cousin inside root/parent/sibling', function(done) {
    // 'Cousin' _id === 4312
    // 'Sibling' _id === 4321
    apos.pages.move(adminReq, '4312', '4321', 'inside', function(err) {
      if (err) {
        console.log(err);
      }
      assert(!err);
    });

    var cursor = apos.pages.find(anonReq, {_id: '4312'});
    cursor.toObject(function(err, page){
      if (err) {
        console.log(err);
      }
      assert(!err);
      //Is the new path correct?
      assert.equal(page.path, '/root/parent/sibling/cousin');
      //Is the rank correct?
      assert.equal(page.rank, 0);
      return done();
    });
  });


  //   it('home has 4 descendants', function(done) {
  //     pages.getDescendants(req, home, { depth: 1 }, function(err, childrenArg) {
  //       children = childrenArg;
  //       assert(children.length === 4);
  //       done();
  //     });
  //   });
  //   it('people is now the final child of home', function(done) {
  //     assert(children[3]._id === 'people');
  //     return done();
  //   });
  //   it('slug of people is now /people', function(done) {
  //     assert(children[3].slug === '/people');
  //     return done();
  //   });
  // });
  //
  // describe('move home/people back under home/about as first child', function() {
  //   var people;
  //   it('people exists', function(done) {
  //     people = children[3];
  //     assert(people._id === 'people');
  //     done();
  //   });
  //   it('moved without error', function(done) {
  //     pages.move(req, people, '/about', 'inside', function(err) {
  //       if (err) {
  //         console.log(err);
  //       }
  //       assert(!err);
  //       return done();
  //    });
  //   });
  //   it('home/about has 3 descendants', function(done) {
  //     pages.getDescendants(req, about, { depth: 1 }, function(err, childrenArg) {
  //       children = childrenArg;
  //       assert(children.length === 3);
  //       done();
  //     });
  //   });
  //   it('first child of home/about is now people', function(done) {
  //     assert(children[0]._id === 'people');
  //     return done();
  //   });
  //   it('people is at /about/people', function(done) {
  //     assert(children[0].slug === '/about/people');
  //     return done();
  //   });
  // });
  //
  // describe('move home/about under home/contact, by slug', function() {
  //   var location;
  //   it('moved without error', function(done) {
  //     pages.move(req, '/about', '/contact', 'inside', function(err) {
  //       if (err) {
  //         console.log(err);
  //       }
  //       assert(!err);
  //       return done();
  //    });
  //   });
  //   it('got contact', function(done) {
  //     apos.pages.findOne({ slug: '/contact' }, function(err, page) {
  //       contact = page;
  //       assert(page);
  //       return done();
  //     });
  //   });
  //   it('home/contact has 1 child', function(done) {
  //     pages.getDescendants(req, contact, { depth: 2 }, function(err, childrenArg) {
  //       children = childrenArg;
  //       assert(children.length === 1);
  //       done();
  //     });
  //   });
  //   it('home/contact/about/location exists at the right path', function(done) {
  //     apos.pages.findOne({ _id: 'location', path: 'home/contact/about/location' }, function(err, page) {
  //       location = page;
  //       assert(location);
  //       return done();
  //     });
  //   });
  //   it('home/contact/about/location has level 3', function(done) {
  //     assert(location.level === 3);
  //     return done();
  //   });
  //   it('home/contact/about/location has slug /contact/about/location', function(done) {
  //     assert(location.slug === '/contact/about/location');
  //     return done();
  //   });


  // it('should have an "insert" method that creates a new page in the database', function(done) {
  //   var object = {
  //     slug: 'one',
  //     published: true,
  //     type: 'testPerson',
  //     firstName: 'Gary',
  //     lastName: 'Ferber',
  //     age: 15,
  //     alive: true
  //   };
  //
  //   apos.docs.insert(adminReq(), object, function(err, object) {
  //     assert(!err);
  //     assert(object);
  //     assert(object._id);
  //     done();
  //   });
  // });
  //
  //
  // it ('should be able to insert a new object into the docs collection in the database', function(done){
  //   var cursor = apos.docs.find(adminReq(), { type: 'testPerson', slug: 'one' });
  //   cursor.toArray(function(err, docs) {
  //     assert(docs[0].slug == 'one');
  //     done();
  //   });
  // });
  //
  //
  //
  // it('should append the slug property with a numeral if inserting an object whose slug already exists in the database', function(done) {
  //   var object = {
  //     slug: 'one',
  //     published: true,
  //     type: 'testPerson',
  //     firstName: 'Harry',
  //     lastName: 'Gerber',
  //     age: 29,
  //     alive: true
  //   };
  //
  //   apos.docs.insert(adminReq(), object, function(err, object){
  //     assert(!err);
  //     assert(object);
  //     assert(object.slug.match(/^one\d+$/));
  //     done();
  //   });
  // });
  //
  // it('should not allow you to call the insert method if you are not an admin', function(done){
  //   var object = {
  //     slug: 'not-for-you',
  //     published: false,
  //     type: 'testPerson',
  //     firstName: 'Darry',
  //     lastName: 'Derrber',
  //     age: 5,
  //     alive: true
  //   };
  //
  //   apos.docs.insert(anonReq(), object, function(err, object){
  //     // did it return an error?
  //     assert(err);
  //     done();
  //   });
  // });
  //
  // //////
  // // UPDATING
  // //////
  //
  // it('should have an "update" method on docs that updates an existing database object based on the "_id" porperty', function(done) {
  //   var cursor = apos.docs.find(adminReq(), { slug: 'one' }).toArray(function(err,docs){
  //     assert(!err);
  //     // we should have a document
  //     assert(docs);
  //     // there should be only one document in our results
  //     assert(docs.length === 1);
  //
  //     // grab the object
  //     var object = docs[0];
  //     // we want update the alive property
  //     object.alive = false
  //
  //     apos.docs.update(adminReq(), object, function(err, object) {
  //       assert(!err);
  //       assert(object);
  //       // has the property been updated?
  //       assert(object.alive === false);
  //       done();
  //     });
  //   });
  // });
  //
  // it('should append an updated slug with a numeral if the updated slug already exists', function(done){
  //
  //   var cursor = apos.docs.find(adminReq(), { type: 'testPerson', slug: 'one' });
  //   cursor.toObject(function(err, doc) {
  //     assert(!err);
  //     assert(doc);
  //
  //     doc.slug = 'peter';
  //
  //     apos.docs.update(adminReq(), doc, function(err, doc) {
  //       assert(!err);
  //       assert(doc);
  //       // has the updated slug been appended?
  //       assert(doc.slug.match(/^peter\d+$/));
  //       done();
  //     });
  //   });
  // });
  //
  // it('should not allow you to call the update method if you are not an admin', function(done){
  //   var cursor = apos.docs.find(anonReq(), { type: 'testPerson', slug: 'lori' });
  //   cursor.toObject(function(err, doc) {
  //     assert(!err);
  //     assert(doc);
  //
  //     doc.slug = 'laurie';
  //
  //     apos.docs.update(anonReq(), doc, function(err, doc) {
  //       // did it return an error?
  //       assert(err);
  //       done();
  //     });
  //   });
  // });
  //
  // //////
  // // TRASH
  // //////
  //
  // it('should have a "trash" method on docs', function(done) {
  //   apos.docs.trash(adminReq(), { slug: 'carl' }, function(err) {
  //     assert(!err);
  //     done();
  //   });
  // });
  //
  // it('should not be able to find the trashed object', function(done){
  //   var cursor = apos.docs.find(adminReq(), { slug: 'carl' }).toObject(function(err,doc){
  //     assert(!err);
  //     // we should not have a document
  //     assert(!doc);
  //     done();
  //   });
  // });
  //
  // it('should not allow you to call the trash method if you are not an admin', function(done){
  //   apos.docs.trash(anonReq(), { slug: 'lori' }, function(err) {
  //     assert(err);
  //     done();
  //   });
  // });
  //
  //
  // it('should be able to find the trashed object when using the "trash" method on find()', function(done){
  //   var cursor = apos.docs.find(adminReq(), { slug: 'carl' }).trash(true).toObject(function(err,doc){
  //     assert(!err);
  //     // we should have a document
  //     assert(doc);
  //     done();
  //   });
  // });
  //
  // //////
  // // RESCUE
  // //////
  //
  // it('should have a "rescue" method on docs that removes the "trash" property from an object', function(done) {
  //   apos.docs.rescue(adminReq(), { slug: 'carl' }, function(err) {
  //     assert(!err);
  //     var cursor = apos.docs.find(adminReq(), { slug: 'carl' }).toObject(function(err, doc){
  //       assert(!err);
  //       // we should have a document
  //       assert(doc);
  //       done();
  //     });
  //   });
  // });
  //
  // it('should not allow you to call the rescue method if you are not an admin', function(done) {
  //   apos.docs.rescue(anonReq(), { slug: 'carl' }, function(err) {
  //     // was there an error?
  //     assert(err);
  //     done();
  //   });
  // });
  //
  // //////
  // // EMPTY TRASH
  // //////
  //
  // it('should have an "emptyTrash" method on docs that removes specified objects from the database which have a "trash" property', function(done) {
  //
  //   return async.series({
  //     trashCarl: function(callback) {
  //       return apos.docs.trash(adminReq(), { slug: 'carl' }, function(err){
  //         assert(!err);
  //         return callback(null);
  //       });
  //     },
  //     emptyTrash: function(callback) {
  //       return apos.docs.emptyTrash(adminReq(), {}, function(err) {
  //         assert(!err);
  //         return callback(null);
  //       });
  //     },
  //     find: function(callback) {
  //       return apos.docs.find(adminReq(), { slug: 'carl' }).trash(true).toObject(function(err, doc) {
  //         assert(!err);
  //         // we should not have a document
  //         assert(!doc);
  //         return callback(null);
  //       });
  //     }
  //   }, done);
  // });
  //
  // it('should not allow you to call the emptyTrash method if you are not an admin', function(done){
  //   return async.series({
  //     trashLarry: function(callback){
  //       return apos.docs.trash(adminReq(), { slug: 'larry' }, function(err){
  //         assert(!err);
  //         return callback(null);
  //       });
  //     },
  //     emptyTrash: function(callback){
  //       apos.docs.emptyTrash(anonReq(), {}, function(err) {
  //         assert(!err);
  //         return callback(null);
  //       });
  //     },
  //     find: function(callback){
  //       return apos.docs.find(adminReq(), { slug: 'larry' }).trash(true).toObject(function(err, doc) {
  //         assert(!err);
  //         // we should have a document
  //         assert(doc);
  //         callback(null);
  //       });
  //     }
  //   }, done);
  //});

});
