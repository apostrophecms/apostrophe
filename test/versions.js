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
      _permissions: {
        admin: true
      }
    }
  });
}


describe('Versions', function() {
	//////
  // EXISTENCE
  //////
  it('should should be a module', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7950
        }
      },
      afterInit: function(callback) {
        assert(apos.versions);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        done();
      }
    });
  });
  it('should have a db property', function() {
    assert(apos.versions.db);
  });


  //////
  // Versioning
  //////

  it('inserting a doc should result in a version', function(done) {
    var object = {
      slug: 'one',
      published: true,
      type: 'testPerson',
      firstName: 'Gary',
      lastName: 'Ferber',
      age: 15,
      alive: true
    };

    apos.docs.insert(adminReq(), object, function(err, object) {
      assert(!err);
      assert(object);
      assert(object._id);
      var docId = object._id;
      //did the versions module kick-in?
      apos.versions.db.find({ docId: docId }).toArray(function(err, versions) {
        assert(!err);
        // we should have a document
        assert(versions);
        // there should be only one document in our results
        assert(versions.length === 1);
        //does it have a property match?
        assert(versions[0].doc.age === 15);
        done();
      });
    });
  });

  it('should be able to update', function(done) {
    var cursor = apos.docs.find(adminReq(), { slug: 'one' }).toArray(function(err,docs){
      assert(!err);
      // we should have a document
      assert(docs);
      // there should be only one document in our results
      assert(docs.length === 1);

      // grab the object
      var object = docs[0];
      // we want update the alive property
      object.alive = false

      apos.docs.update(adminReq(), object, function(err, object) {
        assert(!err);
        assert(object);
        // has the property been updated?
        assert(object.alive === false);

        //did the versions module kick-in?
	      apos.versions.db.find({ docId: object._id }).sort({createdAt: -1}).toArray(function(err,versions){
		    	assert(!err);
		      // we should have a document
		      assert(versions);
		      // there should be two documents now in our results
		      assert(versions.length === 2);
		      // the property should have been updated
		      assert(versions[0].doc.alive === false);
		      assert(versions[1].doc.alive === true);
		      done();
		    });
      });
    });
  });

  it('should be able to revert to a previous version', function(done){
    apos.docs.find(adminReq(), { slug: 'one' }).toObject(function(err,doc) {
      apos.versions.db.find({ docId: doc._id }).sort({createdAt: -1}).toArray(function(err, versions) {
        assert(versions.length === 2);
        apos.versions.revert(adminReq(), doc, versions[1], function(err) {
          assert(!err);
          // make sure the change propagated to the database
          apos.docs.find(adminReq(), { slug: 'one' }).toObject(function(err,doc) {
            assert(!err);
            assert(doc);
            assert(doc.alive === true);
            done();
          });
        });
      });
    });
  });

  //////
  // When disabled the module does not create versions,
  // and docs can still be inserted
  //////
  // it('should not version pages if not set to enabled', function(done) {
  //   apos = require('../index.js')({
  //     root: module,
  //     shortName: 'test',
  //     hostName: 'test.com',
  //     modules: {
  //       'apostrophe-express': {
  //         secret: 'xxx',
  //         port: 7949
  //       },
  //       'apostrophe-doc-versions':{
  //       	enabled: false
  //       }
  //     },
  //     afterInit: function(callback) {
  //       apos.argv._ = [];
  //       assert(!apos.versions.db);
  //       return callback(null);
  //     }
  //   });
  // });
});
