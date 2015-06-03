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


describe('Pieces', function() {

  //////
  // EXISTENCE
  //////

  it('should initialize with a schema and a manager', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7942
        },
        'things': {
          extend: 'apostrophe-pieces',
          name: 'thing',
          label: 'Thing',
          addFields: {
            name: 'foo',
            label: 'Foo',
            type: 'string'
          }
        }
      },
      afterInit: function(callback) {
        assert(apos.modules['things']);
        assert(apos.modules['things'].schema);
        assert(apos.modules['things'].manager);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        done();
      },
    });
  });

  var testThing = {
    _id: 'testThing',
    title: 'hello',
    foo: 'bar'
  };

  // Wipe the database so we can run this test suite independent of bootstrap
  it('should make sure there is no test data hanging around from last time', function(done) {
    // Attempt to purge the entire aposDocs collection
    apos.docs.db.remove({}, function(err) {
      assert(!err);
      // Make sure it went away
      apos.docs.db.find({ _id: 'testThing' }).toArray(function(err, docs){
        assert(docs.length === 0);
        done();
      });
    });
  });

  // Test pieces.newInstance()
  it('should be able to create a new piece', function() {
    assert(apos.modules['things'].newInstance);
    var thing = apos.modules['things'].newInstance();
    assert(thing);
    assert(thing.type === 'thing');
  });

  // Test pieces.insert()
  it('should be able to insert a piece into the database', function(done) {
    assert(apos.modules['things'].insert);
    apos.modules['things'].insert(adminReq(), testThing, function(err) {
      assert(!err);
      done();
    });
  });

  // Test pieces.update()
  it('should be able to update a piece in the database', function(done) {
    assert(apos.modules['things'].update);
    testThing.foo = 'moo';
    apos.modules['things'].update(adminReq(), testThing, function(err) {
      assert(!err);
      done();
    });
  });

  // Test pieces.requirePiece()
  it('should be able to retrieve a piece by id from the database', function(done) {
    assert(apos.modules['things'].requirePiece);
    var requireReq = adminReq();
    requireReq.body = {};
    requireReq.body._id = "testThing";
    apos.modules['things'].requirePiece(requireReq, requireReq.res, function() {
      console.log(req.piece);
      done();
    });
  });

  // Test pieces.addListFilters()


  // Test pieces.list()


  // Test pieces.apiResponse()
  it('should pass through an error message if the error is passed as a string', function(done) {
    assert(apos.modules['things'].apiResponse);
    var res = anonReq().res;
    var errMsg = "Test Error";
    res.send = function(response) {
      assert(response);
      assert(response.status === errMsg);
      assert(!response.data);
      done();
    };

    apos.modules['things'].apiResponse(res, errMsg, { foo: 'bar' });
  });

  it('should not pass through an error message if the error is not passed as a string', function(done) {
    assert(apos.modules['things'].apiResponse);
    var res = anonReq().res;
    var errMsg = true;
    res.send = function(response) {
      assert(response);
      assert(response.status === 'error');
      assert(!response.data);
      done();
    };

    apos.modules['things'].apiResponse(res, errMsg, { foo: 'bar' });
  });

  it('should properly pass a result as a json if there is no error', function(done) {
    assert(apos.modules['things'].apiResponse);
    var res = anonReq().res;
    res.send = function(response) {
      assert(response);
      assert(response.status === 'ok');
      assert(response.data);
      assert(response.data.foo === 'bar');
      done();
    };

    apos.modules['things'].apiResponse(res, null, { foo: 'bar' });
  });

});