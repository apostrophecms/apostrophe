var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var request = require('request');

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

  var additionalThings = [
    {
      _id: 'thing1',
      title: 'Red'
    },
    {
      _id: 'thing2',
      title: 'Blue'
    },
    {
      _id: 'thing3',
      title: 'Green'
    }
  ];

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

  // Test pieces.requirePiece()
  it('should be able to retrieve a piece by id from the database', function(done) {
    assert(apos.modules['things'].requirePiece);
    var req = adminReq();
    req.body = {};
    req.body._id = "testThing";
    apos.modules['things'].requirePiece(req, req.res, function() {
      assert(req.piece);
      assert(req.piece._id === 'testThing');
      assert(req.piece.title === 'hello');
      assert(req.piece.foo === 'bar');
      done();
    });
  });

  // Test pieces.update()
  it('should be able to update a piece in the database', function(done) {
    assert(apos.modules['things'].update);
    testThing.foo = 'moo';
    apos.modules['things'].update(adminReq(), testThing, function(err) {
      assert(!err);

      // Now let's get the piece and check if it was updated
      var req = adminReq();
      req.body = {};
      req.body._id = "testThing";
      apos.modules['things'].requirePiece(req, req.res, function() {
        assert(req.piece);
        assert(req.piece._id === 'testThing');
        assert(req.piece.foo === 'moo');
        done();
      });
    });
  });

  // Test pieces.addListFilters()
  it('should only execute filters that are safe and have a launder method', function() {
    assert(apos.modules['things'].addListFilters);
    var publicTest = false;
    var manageTest = false;
    // addListFilters should execute launder and filters for filter
    // definitions that are safe for 'public' or 'manage' contexts
    var mockCursor = {
      filters: {
        publicTest: {
          launder: function(s) {
            return 'laundered';
          },
          safeFor: 'public'
        },
        manageTest: {
          launder: function(s) {
            return 'laundered';
          },
          safeFor: 'manage'
        },
        unsafeTest: {}
      },
      publicTest: function(value) {
        assert(value === 'laundered');
        publicTest = true;
      },
      manageTest: function(value) {
        assert(value === 'laundered');
        manageTest = true;
      },
      unsafeTest: function(value) {
        assert.fail('unsafe filter ran');
      }
    };

    var filters = {
      publicTest: 'foo',
      manageTest: 'bar',
      unsafeTest: 'nope',
      fakeTest: 'notEvenReal'
    }

    apos.modules['things'].addListFilters(adminReq(), filters, mockCursor);
    assert(publicTest === true);
    assert(manageTest === true);
  });

  // Test pieces.list()
  it('should add some more things for testing', function(done) {
    assert(apos.modules['things'].insert);
    async.each(additionalThings, function(thing, callback) {
      apos.modules['things'].insert(adminReq(), thing, function(err) {
        callback(err);
      });
    }, function(err) {
      assert(!err);
      done();
    })
  });

  it('should list all the pieces if skip and limit are set to large enough values', function(done) {
    assert(apos.modules['things'].list);
    var req = adminReq();
    req.body = {
      limit: 10,
      skip: 0
    };
    apos.modules['things'].list(req, function(err, results) {
      assert(!err);
      assert(results.total == 4);
      assert(results.limit == 10);
      assert(results.skip == 0);
      assert(results.pieces.length == 4);
      done();
    });
  });

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

  // done with api.js tests, now let's test routes
  var routeTestThing = {
    title: 'purple',
    foo: 'bar'
  };

  // HOW DO I PRETEND THAT I AM AN ADMIN WITH A REQUEST
  // POST insert
  it('should insert an item in the database', function(done) {
    return request({
      method: 'POST',
      url: 'http://localhost:7942/modules/things/insert',
      json: {
        piece: routeTestThing
      }
    }, function(err, response, body) {
      //assert(body.toString() === '30');
      console.log(body);
      done();
    });
  });

  // POST retrieve
  // it('should get an item from the database by id', function(done) {
  //   return request({
  //     method: 'POST',
  //     uri: 'http://localhost:7942/modules/things/retrieve',
  //     json: routeTestThing
  //   }).on('response', function(response) {
  //     // console.log(response);
  //     done();
  //   });
  // });

  // // POST list
  // it('should get a list of all the items', function(done) {
  //   return request({
  //     method: 'POST',
  //     uri: 'http://localhost:7942/modules/things/list',
  //     json: routeTestThing
  //   }).on('response', function(response) {
  //     // console.log(response);
  //     done();
  //   });
  // });

  // // POST update
  // it('should update an item in the database', function(done) {
  //   return request({
  //     method: 'POST',
  //     uri: 'http://localhost:7942/modules/things/update',
  //     json: routeTestThing
  //   }).on('response', function(response) {
  //     // console.log(response);
  //     done();
  //   });
  // });

  // POST trash
  // TODO implement

});