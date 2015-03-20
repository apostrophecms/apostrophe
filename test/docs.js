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

function userReq() {
  return _.merge(anonReq(), { 
    user: {
      permissions: {
        admin: true
      }
    }
  });
}


describe('Docs', function() {
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
        slug: 'larry',
        type: 'testPerson',
        firstName: 'Larry',
        lastName: 'Cherber',
        age: 32,
        alive: true
      },
      {
        slug: 'lori',
        type: 'testPerson',
        firstName: 'Lori',
        lastName: 'Pizzaroni',
        age: 28,
        alive: true
      },
      {
        slug: 'carl',
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

  it('should fail if you try to insert a document with the same unique key twice', function(done){
    apos.docs.db.insert([
      {
        type: 'testPerson',
        slug: 'peter'
      },
      {
        type: 'testPerson',
        slug: 'peter'
      }
    ], function(err){
      assert(err);
      done();
    });
  });

  it('should have a find method on docs that returns a cursor', function(){
    var cursor = apos.docs.find();

    assert(cursor);
  });


  it('should be able to find all test documents', function(done){
    var cursor = apos.docs.find(anonReq(), { type: 'testPerson' }).toArray(function(err, docs){
      assert(!err);

      console.log(docs);
      // There should be only 4 results.
      assert(docs.length === 4);

      done();
    });
  });



});