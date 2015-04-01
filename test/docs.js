var assert = require('assert');
var _ = require('lodash');

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

describe('Docs', function() {
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
          port: 7939
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
    var expectedIndexes = ['type', 'slug', 'sortTitle', 'tags', 'published'];
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

  it('should make sure there is no test data hanging around from last time', function(done){
    // Attempt to remove all the test people we know about
    apos.docs.db.remove({
      $or: [
        { slug: 'larry' },
        { slug: 'lori' },
        { slug: 'carl' },
        { slug: 'peter' },
        { slug: 'one'},
        { slug: /^one\d+$/}
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
        slug: 'lori',
        published: true,
        type: 'testPerson',
        firstName: 'Lori',
        lastName: 'Pizzaroni',
        age: 32,
        alive: true
      },
      {
        slug: 'larry',
        published: true,
        type: 'testPerson',
        firstName: 'Larry',
        lastName: 'Cherber',
        age: 28,
        alive: true
      },
      {
        slug: 'carl',
        published: true,
        type: 'testPerson',
        firstName: 'Carl',
        lastName: 'Sagan',
        age: 62,
        alive: false
      }
    ]

    apos.docs.db.insert(testItems, function(err){
      assert(!err);
      done();
    });
  });

  //////
  // UNIQUENESS
  //////

  it('should fail if you try to insert a document with the same unique key twice', function(done){
    apos.docs.db.insert([
      {
        type: 'testPerson',
        published: false,
        age: 70,
        slug: 'peter'
      },
      {
        type: 'testPerson',
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
    var cursor = apos.docs.find();
    assert(cursor);
  });


  it('should be able to find all PUBLISHED test documents and ouput them as an array', function(done){
    var cursor = apos.docs.find(anonReq(), { type: 'testPerson' });

    cursor.toArray(function(err, docs){
      assert(!err);
      // There should be only 3 results.
      assert(docs.length === 3);
      // They should all have a type of testPerson
      assert(docs[0].type === 'testPerson');
      done();
    });
  });


  //////
  // PROJECTIONS
  //////

  it('should be able to specify which fields to get by passing a projection object', function(done){
    var cursor = apos.docs.find(anonReq(), { type: 'testPerson' }, { age: 1 });
    cursor.toArray(function(err, docs){
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
    var cursor = apos.docs.find(anonReq(), { type: 'testPerson' });
    cursor.toArray(function(err, docs){
      _.each(docs, function(doc){
        // There SHOULD NOT be a firstName
        assert(doc.published);
      });

      done();
    });
  });

  it('should be that non-admins do not get unpublished docs, even if they ask for them', function(done) {
    var cursor = apos.docs.find(anonReq(), { type: 'testPerson' }).published(false);
    cursor.toArray(function(err, docs){
      assert(docs.length === 0);
      done();
    });
  });

  it('should be that admins can get unpublished docs if they ask for them', function(done) {
    var cursor = apos.docs.find(adminReq(), { type: 'testPerson' }).published(false);
    cursor.toArray(function(err, docs){
      assert(!docs[0].published);
      done();
    });
  });

  it('should be that admins can get a mixture of unpublished docs and published docs if they ask', function(done) {
    var cursor = apos.docs.find(adminReq(), { type: 'testPerson' }).published(null);
    cursor.toArray(function(err, docs) {
      assert(docs.length === 4);
      done();
    });
  });

  //////
  // SORTING
  //////

  it('should be able to sort', function(done) {
    var cursor = apos.docs.find(anonReq(), { type: 'testPerson' }).sort({ age: 1 });
    cursor.toArray(function(err, docs) {
      assert(docs[0].slug == 'larry');
      done();
    });
  });

  it('should be able to sort by multiple keys', function(done) {
    var cursor = apos.docs.find(anonReq(), { type: 'testPerson' }).sort({ firstName:1 , age: 1 });
    cursor.toArray(function(err, docs) {
      assert(docs[0].slug == 'carl');
      assert(docs[1].slug == 'larry');
      done();
    });
  });

  //////
  // INSTERTING
  //////

  it('should have an "insert" method on docs that returns the new database object', function(done) {
    var object = {
      slug: 'one',
      published: true,
      type: 'testPerson',
      firstName: 'Gary',
      lastName: 'Ferber',
      age: 15,
      alive: true
    };

    apos.docs.insert(adminReq(), object, function(err, object){
      assert(!err);
      assert(object);
      assert(object._id);
      done();
    });
  });


  it ('should have inserted a new object into the docs collection in the database', function(done){
    var cursor = apos.docs.find(adminReq(), { type: 'testPerson', slug: 'one' });
    cursor.toArray(function(err, docs) {
      assert(docs[0].slug == 'one');
      done();
    });
  });



  it('should append the slug property with a numeral if inserting an object whose slug already exists in the database', function(done) {
    var object = {
      slug: 'one',
      published: true,
      type: 'testPerson',
      firstName: 'Harry',
      lastName: 'Gerber',
      age: 29,
      alive: true
    };

    apos.docs.insert(adminReq(), object, function(err, object){
      assert(!err);
      assert(object);
      console.log(object);
      assert(object.slug.match(/^one\d+$/));
      done();
    });
  });

  //////
  // UPDATING
  //////

  it('should have an "update" method on docs that updates an existing database object based on the "_id" porperty', function(done) {
    var cursor = apos.docs.find(adminReq(), { slug: 'one' }).toArray(function(err,docs){
      assert(!err);
      // we should have a document
      assert(docs);
      // there should be only one document in our results
      assert(docs.length === 1);

      // grab the object
      var object = docs[0];
      // we want to use the _id property to update this docuemtn
      var updateId = object._id;
      // we want update the alive property
      object.alive = false

      apos.docs.update(adminReq(), updateId, object, function(err, object) {
        assert(!err);
        assert(object);
        // has the property been updated?
        assert(object.alive === false);
        done();
      });
    });
  });

  it('should have an "update" method on docs that updates an existing object based on a property that is not the "_id"', function(done) {
    var object = {
      slug: 'one',
      published: true,
      type: 'testPerson',
      firstName: 'Gary',
      lastName: 'Ferber',
      age: 15,
      alive: true
    };

    apos.docs.update(adminReq(), { slug: 'one' }, object, function(err, object) {
      assert(!err);
      assert(object);
      // has the property been updated?
      assert(object.alive === true);
      done();
    });
  });

  it('should append an updated slug with a numeral if the updated slug already exists', function(done){
    var object = {
      slug: 'peter',
      published: true,
      type: 'testPerson',
      firstName: 'Gary',
      lastName: 'Ferber',
      age: 15,
      alive: true
    };

    apos.docs.update(adminReq(), { slug: 'one' }, object, function(err, object) {
      assert(!err);
      assert(object);
      // has the updated slug been appended?
      assert(object.slug.match(/^peter\d+$/));
      done();
    });
  });

  //////
  // TRASH
  //////

  it('should have a "trash" method on docs', function(done) {
    apos.docs.trash(adminReq(), { slug: 'carl' }, function(err) {
      assert(!err);
      done();
    });
  });

  it('should not be able to find the trashed object', function(done){
    var cursor = apos.docs.find(adminReq(), { slug: 'carl' }).toObject(function(err,doc){
      assert(!err);
      // we should not have a document
      assert(!doc);
      done();
    });
  });


  it('should be able to find the trashed object when using the "trash" method on find()', function(done){
    var cursor = apos.docs.find(adminReq(), { slug: 'carl' }).trash(true).toObject(function(err,doc){
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
    apos.docs.rescue(adminReq(), { slug: 'carl' }, function(err, object) {
      assert(!err);
      assert(object);
      // the object should no longer have a trash property
      assert(!object.trash);
      done();
    });
  });

  //////
  // EMPTY TRASH
  //////

  it('should have an "emptyTrash" method on docs that removes specified objects from the database which have a "trash" property', function(done) {
    apos.docs.trash(adminReq(), { slug: 'carl' }, function(err){
      assert(!err);
    });

    apos.docs.emptyTrash(adminReq(), {}, function(err) {
      assert(!err);
    });

    var cursor = apos.docs.find(adminReq(), { slug: 'carl' }).trash(true).toObject(function(err, doc) {
      assert(!err);
      // we should not have a document
      assert(!doc);
      done();
    });
  });

});
