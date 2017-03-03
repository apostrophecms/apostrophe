var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var t = require('./testUtils')

var apos;

describe('Docs', function() {

  this.timeout(5000);

  after(function() {
    apos.db.dropDatabase();
  });

  //////
  // EXISTENCE
  //////

  it('should be a property of the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7939
        },
        'test-people': {
          extend: 'apostrophe-doc-type-manager',
          name: 'test-person'
        }
      },
      afterInit: function(callback) {
        assert(apos.docs);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        done();
      }
    });
  });

  it('should have a db property', function() {
    assert(apos.docs.db);
  });

  //////
  // SETUP
  //////


  it('should make sure all of the expected indexes are configured', function(done){
    var expectedIndexes = ['type', 'slug', 'titleSortified', 'tags', 'published'];
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
      apos.docs.db.find({ slug: 'larry' }).toArray(function(err, docs){
        assert(docs.length === 0);
        done();
      });
    });
  });

  it('should be able to use db to insert documents', function(done){
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
    ]

    apos.docs.db.insert(testItems, function(err){
      assert(!err);
      done();
    });
  });

  it('should be able to carry out schema joins', function(done) {

    apos.docs.setManager('test-person', {
      schema: [
        {
          name: '_friend',
          type: 'joinByOne',
          withType: 'test-person',
          idField: 'friendId',
          label: 'Friend'
        }
      ],
      find: function(req, criteria, projection) {
        return apos.docs.find(req, criteria, projection).type('test-person');
      }
    });

    var manager = apos.docs.getManager('test-person');

    assert(manager);
    assert(manager.find);
    assert(manager.schema);

    var cursor = manager.find(t.req.anon(apos), { slug: 'carl' });
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

  //////
  // UNIQUENESS
  //////

  it('should fail if you try to insert a document with the same unique key twice', function(done){
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
    ], function(err){
      assert(err);
      done();
    });
  });

  //////
  // FINDING
  //////

  it('should have a find method on docs that returns a cursor', function(){
    var cursor = apos.docs.find(t.req.anon(apos));
    assert(cursor);
  });


  it('should be able to find all PUBLISHED test documents and ouput them as an array', function(done){
    var cursor = apos.docs.find(t.req.anon(apos), { type: 'test-person' });

    cursor.toArray(function(err, docs){
      assert(!err);
      // There should be only 3 results.
      assert(docs.length === 3);
      // They should all have a type of test-person
      assert(docs[0].type === 'test-person');
      done();
    });
  });


  //////
  // PROJECTIONS
  //////

  it('should be able to specify which fields to get by passing a projection object', function(done){
    var cursor = apos.docs.find(t.req.anon(apos), { type: 'test-person' }, { age: 1 });
    cursor.toArray(function(err, docs){

      assert(!err);
      // There SHOULD be an age
      assert(docs[0].age);

      // There SHOULD NOT be a firstName
      assert(!docs[0].firstName);
      done();
    });
  });

  //////
  // PUBLISHED vs UNPUBLISHED
  //////

  it('should be that non-admins DO NOT get unpublished docs by default', function(done) {
    var cursor = apos.docs.find(t.req.anon(apos), { type: 'test-person' });
    cursor.toArray(function(err, docs){
      _.each(docs, function(doc){
        // There SHOULD NOT be a firstName
        assert(doc.published);
      });

      done();
    });
  });

  it('should be that non-admins do not get unpublished docs, even if they ask for them', function(done) {
    var cursor = apos.docs.find(t.req.anon(apos), { type: 'test-person' }).published(false);
    cursor.toArray(function(err, docs){
      assert(docs.length === 0);
      done();
    });
  });

  it('should be that admins can get unpublished docs if they ask for them', function(done) {
    var cursor = apos.docs.find(t.req.admin(apos), { type: 'test-person' }).published(false);
    cursor.toArray(function(err, docs){
      assert(!docs[0].published);
      done();
    });
  });

  it('should be that admins can get a mixture of unpublished docs and published docs if they ask', function(done) {
    var cursor = apos.docs.find(t.req.admin(apos), { type: 'test-person' }).published(null);
    cursor.toArray(function(err, docs) {
      assert(docs.length === 4);
      done();
    });
  });

  //////
  // SORTING
  //////

  it('should be able to sort', function(done) {
    var cursor = apos.docs.find(t.req.anon(apos), { type: 'test-person' }).sort({ age: 1 });
    cursor.toArray(function(err, docs) {
      assert(docs[0].slug == 'larry');
      done();
    });
  });

  it('should be able to sort by multiple keys', function(done) {
    var cursor = apos.docs.find(t.req.anon(apos), { type: 'test-person' }).sort({ firstName:1 , age: 1 });
    cursor.toArray(function(err, docs) {
      assert(docs[0].slug == 'carl');
      assert(docs[1].slug == 'larry');
      done();
    });
  });

  //////
  // INSERTING
  //////

  it('should have an "insert" method that returns a new database object', function(done) {
    var object = {
      slug: 'one',
      published: true,
      type: 'test-person',
      firstName: 'Gary',
      lastName: 'Ferber',
      age: 15,
      alive: true
    };

    apos.docs.insert(t.req.admin(apos), object, function(err, object) {
      assert(!err);
      assert(object);
      assert(object._id);
      done();
    });
  });


  it ('should be able to insert a new object into the docs collection in the database', function(done){
    var cursor = apos.docs.find(t.req.admin(apos), { type: 'test-person', slug: 'one' });
    cursor.toArray(function(err, docs) {
      assert(docs[0].slug == 'one');
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

    apos.docs.insert(t.req.admin(apos), object, function(err, object){
      assert(!err);
      assert(object);
      assert(object.slug.match(/^one\d+$/));
      done();
    });
  });

  it('should not allow you to call the insert method if you are not an admin', function(done){
    var object = {
      slug: 'not-for-you',
      published: false,
      type: 'test-person',
      firstName: 'Darry',
      lastName: 'Derrber',
      age: 5,
      alive: true
    };

    apos.docs.insert(t.req.anon(apos), object, function(err, object){
      // did it return an error?
      assert(err);
      done();
    });
  });

  //////
  // UPDATING
  //////

  it('should have an "update" method on docs that updates an existing database object based on the "_id" porperty', function(done) {
    var cursor = apos.docs.find(t.req.admin(apos), { slug: 'one' }).toArray(function(err,docs){
      assert(!err);
      // we should have a document
      assert(docs);
      // there should be only one document in our results
      assert(docs.length === 1);

      // grab the object
      var object = docs[0];
      // we want update the alive property
      object.alive = false

      apos.docs.update(t.req.admin(apos), object, function(err, object) {
        assert(!err);
        assert(object);
        // has the property been updated?
        assert(object.alive === false);
        done();
      });
    });
  });

  it('should append an updated slug with a numeral if the updated slug already exists', function(done){

    var cursor = apos.docs.find(t.req.admin(apos), { type: 'test-person', slug: 'one' });
    cursor.toObject(function(err, doc) {
      assert(!err);
      assert(doc);

      doc.slug = 'peter';

      apos.docs.update(t.req.admin(apos), doc, function(err, doc) {
        assert(!err);
        assert(doc);
        // has the updated slug been appended?
        assert(doc.slug.match(/^peter\d+$/));
        done();
      });
    });
  });

  it('should not allow you to call the update method if you are not an admin', function(done){
    var cursor = apos.docs.find(t.req.anon(apos), { type: 'test-person', slug: 'lori' });
    cursor.toObject(function(err, doc) {
      assert(!err);
      assert(doc);

      doc.slug = 'laurie';

      apos.docs.update(t.req.anon(apos), doc, function(err, doc) {
        // did it return an error?
        assert(err);
        done();
      });
    });
  });

  //////
  // TRASH
  //////

  it('should have a "trash" method on docs', function(done) {
    apos.docs.trash(t.req.admin(apos), { slug: 'carl' }, function(err) {
      assert(!err);
      done();
    });
  });

  it('should not be able to find the trashed object', function(done){
    var cursor = apos.docs.find(t.req.admin(apos), { slug: 'carl' }).toObject(function(err,doc){
      assert(!err);
      // we should not have a document
      assert(!doc);
      done();
    });
  });

  it('should not allow you to call the trash method if you are not an admin', function(done){
    apos.docs.trash(t.req.anon(apos), { slug: 'lori' }, function(err) {
      assert(err);
      done();
    });
  });


  it('should be able to find the trashed object when using the "trash" method on find()', function(done){
    var cursor = apos.docs.find(t.req.admin(apos), { slug: 'carl' }).trash(true).toObject(function(err,doc){
      assert(!err);
      // we should have a document
      assert(doc);
      done();
    });
  });

  //////
  // RESCUE
  //////

  it('should have a "rescue" method on docs that removes the "trash" property from an object', function(done) {
    apos.docs.rescue(t.req.admin(apos), { slug: 'carl' }, function(err) {
      assert(!err);
      var cursor = apos.docs.find(t.req.admin(apos), { slug: 'carl' }).toObject(function(err, doc){
        assert(!err);
        // we should have a document
        assert(doc);
        done();
      });
    });
  });

  it('should not allow you to call the rescue method if you are not an admin', function(done) {
    apos.docs.rescue(t.req.anon(apos), { slug: 'carl' }, function(err) {
      // was there an error?
      assert(err);
      done();
    });
  });

  //////
  // EMPTY TRASH
  //////

  it('should have an "deleteFromTrash" method on docs that removes specified objects from the database which have a "trash" property', function(done) {

    return async.series({
      trashCarl: function(callback) {
        return apos.docs.trash(t.req.admin(apos), { slug: 'carl' }, function(err){
          assert(!err);
          return callback(null);
        });
      },
      deleteFromTrash: function(callback) {
        return apos.docs.deleteFromTrash(t.req.admin(apos), {}, function(err) {
          assert(!err);
          return callback(null);
        });
      },
      find: function(callback) {
        return apos.docs.find(t.req.admin(apos), { slug: 'carl' }).trash(true).toObject(function(err, doc) {
          assert(!err);
          // we should not have a document
          assert(!doc);
          return callback(null);
        });
      }
    }, done);
  });

  it('should not allow you to call the deleteFromTrash method if you are not an admin', function(done){
    return async.series({
      trashLarry: function(callback){
        return apos.docs.trash(t.req.admin(apos), { slug: 'larry' }, function(err){
          assert(!err);
          return callback(null);
        });
      },
      deleteFromTrash: function(callback){
        apos.docs.deleteFromTrash(t.req.anon(apos), {}, function(err) {
          assert(!err);
          return callback(null);
        });
      },
      find: function(callback){
        return apos.docs.find(t.req.admin(apos), { slug: 'larry' }).trash(true).toObject(function(err, doc) {
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

});
