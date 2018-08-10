var t = require('../test-lib/test.js');
var assert = require('assert');
var _ = require('@sailshq/lodash');
var async = require('async');
var apos;

describe('Docs', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  // EXISTENCE

  it('should be a property of the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900
        },
        'test-people': {
          extend: 'apostrophe-doc-type-manager',
          name: 'test-person',
          addFields: [
            {
              name: '_friend',
              type: 'joinByOne',
              withType: 'test-person',
              idField: 'friendId',
              label: 'Friend'
            }
          ]
        }
      },
      afterInit: function(callback) {
        assert(apos.docs);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  it('should have a db property', function() {
    assert(apos.docs.db);
  });

  /// ///
  // SETUP
  /// ///

  it('should make sure all of the expected indexes are configured', function(done) {
    var expectedIndexes = ['type', 'slug', 'titleSortified', 'tags', 'published'];
    var actualIndexes = [];

    apos.docs.db.indexInformation(function(err, info) {
      assert(!err);

      // Extract the actual index info we care about
      _.each(info, function(index) {
        actualIndexes.push(index[0][0]);
      });

      // Now make sure everything in expectedIndexes is in actualIndexes
      _.each(expectedIndexes, function(index) {
        assert(_.contains(actualIndexes, index));
      });

      // Lastly, make sure there is a text index present
      assert(info.highSearchText_text_lowSearchText_text_title_text_searchBoost_text[0][1] === 'text');
      done();
    });
  });

  it('should make sure there is no test data hanging around from last time', function(done) {
    // Attempt to purge the entire aposDocs collection
    apos.docs.db.remove({}, function(err) {
      assert(!err);
      // Make sure it went away
      apos.docs.db.findWithProjection({ slug: 'larry' }).toArray(function(err, docs) {
        assert(!err);
        assert(docs.length === 0);
        done();
      });
    });
  });

  it('should be able to use db to insert documents', function(done) {
    var testItems = [
      {
        _id: 'lori',
        slug: 'lori',
        published: true,
        type: 'test-person',
        firstName: 'Lori',
        lastName: 'Pizzaroni',
        age: 32,
        alive: true
      },
      {
        _id: 'larry',
        slug: 'larry',
        published: true,
        type: 'test-person',
        firstName: 'Larry',
        lastName: 'Cherber',
        age: 28,
        alive: true
      },
      {
        _id: 'carl',
        slug: 'carl',
        published: true,
        type: 'test-person',
        firstName: 'Carl',
        lastName: 'Sagan',
        age: 62,
        alive: false,
        friendId: 'larry'
      }
    ];

    apos.docs.db.insert(testItems, function(err) {
      assert(!err);
      done();
    });
  });

  it('should be able to carry out schema joins', function(done) {

    var manager = apos.docs.getManager('test-person');

    assert(manager);
    assert(manager.find);
    assert(manager.schema);

    var cursor = manager.find(apos.tasks.getAnonReq(), { slug: 'carl' });
    assert(cursor);
    cursor.toObject(function(err, person) {
      assert(!err);
      assert(person);
      assert(person.slug === 'carl');
      assert(person._friend);
      assert(person._friend.slug === 'larry');
      done();
    });
  });

  /// ///
  // UNIQUENESS
  /// ///

  it('should fail if you try to insert a document with the same unique key twice', function(done) {
    apos.docs.db.insert([
      {
        type: 'test-person',
        published: false,
        age: 70,
        slug: 'peter'
      },
      {
        type: 'test-person',
        published: false,
        age: 70,
        slug: 'peter'
      }
    ], function(err) {
      assert(err);
      done();
    });
  });

  /// ///
  // FINDING
  /// ///

  it('should have a find method on docs that returns a cursor', function() {
    var cursor = apos.docs.find(apos.tasks.getAnonReq());
    assert(cursor);
  });

  it('should be able to find all PUBLISHED test documents and output them as an array', function(done) {
    var cursor = apos.docs.find(apos.tasks.getAnonReq(), { type: 'test-person' });

    cursor.toArray(function(err, docs) {
      assert(!err);
      // There should be only 3 results.
      assert(docs.length === 3);
      // They should all have a type of test-person
      assert(docs[0].type === 'test-person');
      done();
    });
  });

  it('same thing, but with promises', function(done) {
    apos.docs.find(apos.tasks.getAnonReq(), { type: 'test-person' }).toArray().then(function(docs) {
      // There should be only 3 results.
      assert(docs.length === 3);
      // They should all have a type of test-person
      assert(docs[0].type === 'test-person');
      done();
    }).catch(function(err) {
      assert(!err);
    });
  });

  /// ///
  // PROJECTIONS
  /// ///

  it('should be able to specify which fields to get by passing a projection object', function(done) {
    var cursor = apos.docs.find(apos.tasks.getAnonReq(), { type: 'test-person' }, { age: 1 });
    cursor.toArray(function(err, docs) {

      assert(!err);
      // There SHOULD be an age
      assert(docs[0].age);

      // There SHOULD NOT be a firstName
      assert(!docs[0].firstName);
      done();
    });
  });

  /// ///
  // PUBLISHED vs UNPUBLISHED
  /// ///

  it('should be that non-admins DO NOT get unpublished docs by default', function(done) {
    var cursor = apos.docs.find(apos.tasks.getAnonReq(), { type: 'test-person' });
    cursor.toArray(function(err, docs) {
      assert(!err);
      _.each(docs, function(doc) {
        // There SHOULD NOT be a firstName
        assert(doc.published);
      });

      done();
    });
  });

  it('should be that non-admins do not get unpublished docs, even if they ask for them', function(done) {
    var cursor = apos.docs.find(apos.tasks.getAnonReq(), { type: 'test-person' }).published(false);
    cursor.toArray(function(err, docs) {
      assert(!err);
      assert(docs.length === 0);
      done();
    });
  });

  it('should be that admins can get unpublished docs if they ask for them', function(done) {
    var cursor = apos.docs.find(apos.tasks.getReq(), { type: 'test-person' }).published(false);
    cursor.toArray(function(err, docs) {
      assert(!err);
      assert(!docs[0].published);
      done();
    });
  });

  it('should be that admins can get a mixture of unpublished docs and published docs if they ask', function(done) {
    var cursor = apos.docs.find(apos.tasks.getReq(), { type: 'test-person' }).published(null);
    cursor.toArray(function(err, docs) {
      assert(!err);
      assert(docs.length === 4);
      done();
    });
  });

  /// ///
  // SORTING
  /// ///

  it('should be able to sort', function(done) {
    var cursor = apos.docs.find(apos.tasks.getAnonReq(), { type: 'test-person' }).sort({ age: 1 });
    cursor.toArray(function(err, docs) {
      assert(!err);
      assert(docs[0].slug === 'larry');
      done();
    });
  });

  it('should be able to sort by multiple keys', function(done) {
    var cursor = apos.docs.find(apos.tasks.getAnonReq(), { type: 'test-person' }).sort({ firstName: 1, age: 1 });
    cursor.toArray(function(err, docs) {
      assert(!err);
      assert(docs[0].slug === 'carl');
      assert(docs[1].slug === 'larry');
      done();
    });
  });

  /// ///
  // INSERTING
  /// ///

  it('should have an "insert" method that returns a new database object', function(done) {
    var object = {
      slug: 'one',
      published: true,
      type: 'test-person',
      firstName: 'Lori',
      lastName: 'Ferber',
      age: 15,
      alive: true
    };

    apos.docs.insert(apos.tasks.getReq(), object, function(err, object) {
      assert(!err);
      assert(object);
      assert(object._id);
      done();
    });
  });

  it('should be able to insert a new object into the docs collection in the database', function(done) {
    var cursor = apos.docs.find(apos.tasks.getReq(), { type: 'test-person', slug: 'one' });
    cursor.toArray(function(err, docs) {
      assert(!err);
      assert(docs[0].slug === 'one');
      done();
    });
  });

  it('should append the slug property with a numeral if inserting an object whose slug already exists in the database', function(done) {
    var object = {
      slug: 'one',
      published: true,
      type: 'test-person',
      firstName: 'Harry',
      lastName: 'Gerber',
      age: 29,
      alive: true
    };

    apos.docs.insert(apos.tasks.getReq(), object, function(err, object) {
      assert(!err);
      assert(object);
      assert(object.slug.match(/^one\d+$/));
      done();
    });
  });

  it('should not allow you to call the insert method if you are not an admin', function(done) {
    var object = {
      slug: 'not-for-you',
      published: false,
      type: 'test-person',
      firstName: 'Darry',
      lastName: 'Derrber',
      age: 5,
      alive: true
    };

    apos.docs.insert(apos.tasks.getAnonReq(), object, function(err, object) {
      // did it return an error?
      assert(err);
      done();
    });
  });

  /// ///
  // UPDATING
  /// ///

  it('should have an "update" method on docs that updates an existing database object based on the "_id" porperty', function(done) {
    apos.docs.find(apos.tasks.getReq(), { slug: 'one' }).toArray(function(err, docs) {
      assert(!err);
      // we should have a document
      assert(docs);
      // there should be only one document in our results
      assert(docs.length === 1);

      // grab the object
      var object = docs[0];
      // we want update the alive property
      object.alive = false;

      apos.docs.update(apos.tasks.getReq(), object, function(err, object) {
        assert(!err);
        assert(object);
        // has the property been updated?
        assert(object.alive === false);
        done();
      });
    });
  });

  it('should append an updated slug with a numeral if the updated slug already exists', function(done) {

    var cursor = apos.docs.find(apos.tasks.getReq(), { type: 'test-person', slug: 'one' });
    cursor.toObject(function(err, doc) {
      assert(!err);
      assert(doc);

      doc.slug = 'peter';

      apos.docs.update(apos.tasks.getReq(), doc, function(err, doc) {
        assert(!err);
        assert(doc);
        // has the updated slug been appended?
        assert(doc.slug.match(/^peter\d+$/));
        done();
      });
    });
  });

  it('same thing, but with promises', function(done) {

    // We need to insert another, we used 'one' up
    var object = {
      slug: 'two',
      published: true,
      type: 'test-person',
      firstName: 'Twofy',
      lastName: 'Twofer',
      age: 15,
      alive: true
    };

    apos.docs.insert(apos.tasks.getReq(), object)
      .then(function(doc) {
        var cursor;
        assert(doc);
        assert(doc._id);
        cursor = apos.docs.find(apos.tasks.getReq(), { type: 'test-person', slug: 'two' });
        return cursor.toObject();
      })
      .then(function(doc) {
        assert(doc);
        doc.slug = 'peter';
        return apos.docs.update(apos.tasks.getReq(), doc);
      })
      .then(function(doc) {
        assert(doc);
        // has the updated slug been appended?
        assert(doc.slug.match(/^peter\d+$/));
        done();
      })
      .catch(function(err) {
        assert(!err);
      });
  });

  it('should be able to fetch all unique firstNames with toDistinct', function() {
    return apos.docs.find(apos.tasks.getReq(), { type: 'test-person' }).toDistinct('firstName')
      .then(function(firstNames) {
        assert(Array.isArray(firstNames));
        assert(firstNames.length === 5);
        assert(_.contains(firstNames, 'Larry'));
      });
  });

  it('should be able to fetch all unique firstNames and their counts with toDistinct and distinctCounts', function() {
    var cursor = apos.docs.find(apos.tasks.getReq(), { type: 'test-person' }).distinctCounts(true);
    return cursor.toDistinct('firstName')
      .then(function(firstNames) {
        assert(Array.isArray(firstNames));
        assert(firstNames.length === 5);
        assert(_.contains(firstNames, 'Larry'));
        var counts = cursor.get('distinctCounts');
        assert(counts['Larry'] === 1);
        assert(counts['Lori'] === 2);
      });
  });

  it('should not allow you to call the update method if you are not an admin', function(done) {
    var cursor = apos.docs.find(apos.tasks.getAnonReq(), { type: 'test-person', slug: 'lori' });
    cursor.toObject(function(err, doc) {
      assert(!err);
      assert(doc);

      doc.slug = 'laurie';

      apos.docs.update(apos.tasks.getAnonReq(), doc, function(err, doc) {
        // did it return an error?
        assert(err);
        done();
      });
    });
  });

  /// ///
  // TRASH
  /// ///

  it('should have a "trash" method on docs', function(done) {
    apos.docs.trash(apos.tasks.getReq(), { slug: 'carl' }, function(err) {
      assert(!err);
      done();
    });
  });

  it('should not be able to find the trashed object', function(done) {
    apos.docs.find(apos.tasks.getReq(), { slug: 'carl' }).toObject(function(err, doc) {
      assert(!err);
      // we should not have a document
      assert(!doc);
      done();
    });
  });

  it('should not allow you to call the trash method if you are not an admin', function(done) {
    apos.docs.trash(apos.tasks.getAnonReq(), { slug: 'lori' }, function(err) {
      assert(err);
      done();
    });
  });

  it('should be able to find the trashed object when using the "trash" method on find()', function(done) {
    apos.docs.find(apos.tasks.getReq(), { slug: 'carl' }).trash(true).toObject(function(err, doc) {
      assert(!err);
      // we should have a document
      assert(doc);
      done();
    });
  });

  /// ///
  // RESCUE
  /// ///

  it('should have a "rescue" method on docs that removes the "trash" property from an object', function(done) {
    apos.docs.rescue(apos.tasks.getReq(), { slug: 'carl' }, function(err) {
      assert(!err);
      apos.docs.find(apos.tasks.getReq(), { slug: 'carl' }).toObject(function(err, doc) {
        assert(!err);
        // we should have a document
        assert(doc);
        done();
      });
    });
  });

  it('should not allow you to call the rescue method if you are not an admin', function(done) {
    apos.docs.rescue(apos.tasks.getAnonReq(), { slug: 'carl' }, function(err) {
      // was there an error?
      assert(err);
      done();
    });
  });

  /// ///
  // EMPTY TRASH
  /// ///

  it('should have an "deleteFromTrash" method on docs that removes specified objects from the database which have a "trash" property', function(done) {

    return async.series({
      trashCarl: function(callback) {
        return apos.docs.trash(apos.tasks.getReq(), { slug: 'carl' }, function(err) {
          assert(!err);
          return callback(null);
        });
      },
      deleteFromTrash: function(callback) {
        return apos.docs.deleteFromTrash(apos.tasks.getReq(), {}, function(err) {
          assert(!err);
          return callback(null);
        });
      },
      find: function(callback) {
        return apos.docs.find(apos.tasks.getReq(), { slug: 'carl' }).trash(true).toObject(function(err, doc) {
          assert(!err);
          // we should not have a document
          assert(!doc);
          return callback(null);
        });
      }
    }, done);
  });

  it('should not allow you to call the deleteFromTrash method if you are not an admin', function(done) {
    return async.series({
      trashLarry: function(callback) {
        return apos.docs.trash(apos.tasks.getReq(), { slug: 'larry' }, function(err) {
          assert(!err);
          return callback(null);
        });
      },
      deleteFromTrash: function(callback) {
        apos.docs.deleteFromTrash(apos.tasks.getAnonReq(), {}, function(err) {
          assert(!err);
          return callback(null);
        });
      },
      find: function(callback) {
        return apos.docs.find(apos.tasks.getReq(), { slug: 'larry' }).trash(true).toObject(function(err, doc) {
          assert(!err);
          // we should have a document
          assert(doc);
          callback(null);
        });
      }
    }, done);
  });

  it('should throw an exception on find() if you fail to pass req as the first argument', function() {
    var exception;
    try {
      apos.docs.find({ slug: 'larry' });
    } catch (e) {
      exception = e;
    }
    assert(exception);
  });

  it('should respect explicitOrder()', function(done) {

    var testItems = [];
    var i;
    for (i = 0; (i < 100); i++) {
      testItems.push({
        _id: 'i' + i,
        slug: 'i' + i,
        published: true,
        type: 'test',
        title: 'title: ' + i
      });
    }

    return apos.docs.db.insert(testItems, function(err) {
      assert(!err);
      return apos.docs.find(apos.tasks.getAnonReq(), {}).explicitOrder([ 'i7', 'i3', 'i27', 'i9' ]).toArray(function(err, docs) {
        assert(!err);
        assert(docs[0]._id === 'i7');
        assert(docs[1]._id === 'i3');
        assert(docs[2]._id === 'i27');
        assert(docs[3]._id === 'i9');
        assert(!docs[4]);
        return done();
      });
    });

  });

  it('should respect explicitOrder with skip and limit', function(done) {

    // Relies on test data of previous test
    return apos.docs.find(apos.tasks.getAnonReq(), {}).explicitOrder([ 'i7', 'i3', 'i27', 'i9' ]).skip(2).limit(2).toArray(function(err, docs) {
      assert(!err);
      assert(docs[0]._id === 'i27');
      assert(docs[1]._id === 'i9');
      assert(!docs[2]);
      return done();
    });

  });

  it('should be able to lock a document', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.lock(req, 'i27', 'abc', function(err) {
      assert(!err);
      done();
    });
  });

  it('should not be able to lock a document with a different contextId', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.lock(req, 'i27', 'def', function(err) {
      assert(err);
      assert(err === 'locked');
      done();
    });
  });

  it('should be able to unlock a document', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.unlock(req, 'i27', 'abc', function(err) {
      assert(!err);
      done();
    });
  });

  it('should be able to re-lock an unlocked document', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.lock(req, 'i27', 'def', function(err) {
      assert(!err);
      done();
    });
  });

  it('should be able to lock a locked document with force: true', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.lock(req, 'i27', 'abc', { force: true }, function(err) {
      assert(!err);
      done();
    });
  });

  it('should be able to unlock all documents locked with the same contextId', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.lock(req, 'i26', 'abc', function(err) {
      assert(!err);
      apos.docs.lock(req, 'i25', 'abc', function(err) {
        assert(!err);
        apos.docs.unlockAll(req, 'abc', function(err) {
          assert(!err);
          apos.docs.lock(req, 'i26', 'def', function(err) {
            assert(!err);
            done();
          });
        });
      });
    });
  });

});
