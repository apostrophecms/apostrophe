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
        { type: 'testPerson' }
      ]
    }, function(err){
      assert(!err);
      // Now look for one of them and make sure they don't exist anymore
      apos.docs.db.find({ slug: 'larry' }).toArray(function(err, docs){
        assert(docs.length === 0);
        done();
      });
    });
  });

  it('should be able to use db to insert documents', function(done){
    var testItems = [
      {
        slug: 'parent',
        published: true,
        path: '/root/parent'
      },
      {
        slug: 'child',
        published: true,
        path: '/root/parent/child'
      },
      {
        slug: 'root',
        published: true,
        path: '/root'
      },
      {
        slug: 'grandchild',
        published: true,
        path: '/root/parent/child/grandchild'
      },
      {
        slug: 'sibling',
        published: true,
        path: '/root/parent/sibling'
      },
      {
        slug: 'cousin',
        published: true,
        path: '/root/parent/sibling/cousin'
      }

    ]

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
      assert.equals(page._ancestors[0].path, '/root');
      // The second ancestor should be 'parent'
      assert.equals(page._ancestors[1].path, '/root/parent');
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
      // The first ancestor's child should have a path '/root/parent/sibling'
      assert.equals(page._ancestors[1]._children[0].path, '/root/parent/sibling');
      done();
    });
  });


  //////
  // INSERTING
  //////

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
