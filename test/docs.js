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
        { slug: 'peter' }
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
      // There should be only 4 results.
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

});
