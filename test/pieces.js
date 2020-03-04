let t = require('../test-lib/test.js');
let assert = require('assert');
let _ = require('lodash');
let async = require('async');

let apos;

describe('Pieces', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize with a schema', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900
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
        },
        'people': {
          extend: 'apostrophe-pieces',
          name: 'person',
          label: 'Person',
          addFields: {
            name: '_things',
            type: 'joinByArray'
          }
        }
      },
      afterInit: function(callback) {
        assert(apos.modules['things']);
        assert(apos.modules['things'].schema);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  // little test-helper function to get piece by id regardless of trash status
  function findPiece(req, id, callback) {
    return apos.modules['things'].find(req, { _id: id })
      .permission('edit')
      .published(null)
      .trash(null)
      .toObject(function(err, piece) {
        if (err) {
          return callback(err);
        }
        if (!piece) {
          return callback('notfound');
        }
        return callback(err, piece);
      }
      );
  };

  let testThing = {
    _id: 'testThing',
    title: 'hello',
    foo: 'bar'
  };

  let testThing2 = {
    _id: 'testThing2',
    title: 'hello2',
    foo: 'bar2'
  };

  let additionalThings = [
    {
      _id: 'thing1',
      title: 'Red'
    },
    {
      _id: 'thing2',
      title: 'Blue',
      published: true
    },
    {
      _id: 'thing3',
      title: 'Green',
      published: true
    }
  ];

  let testPeople = [
    {
      _id: 'person1',
      title: 'Bob',
      type: 'person',
      thingsIds: [ 'thing2', 'thing3' ],
      published: true
    }
  ];

  // Wipe the database so we can run this test suite independent of bootstrap
  it('should make sure there is no test data hanging around from last time', function(done) {
    // Attempt to purge the entire aposDocs collection
    apos.docs.db.deleteMany({}, function(err) {
      assert(!err);
      // Make sure it went away
      apos.docs.db.findWithProjection({ _id: 'testThing' }).toArray(function(err, docs) {
        assert(!err);
        assert(docs.length === 0);
        done();
      });
    });
  });

  // Test pieces.newInstance()
  it('should be able to create a new piece', function() {
    assert(apos.modules['things'].newInstance);
    let thing = apos.modules['things'].newInstance();
    assert(thing);
    assert(thing.type === 'thing');
  });

  // Test pieces.insert()
  it('should be able to insert a piece into the database', function(done) {
    assert(apos.modules['things'].insert);
    apos.modules['things'].insert(apos.tasks.getReq(), testThing, function(err, piece) {
      assert(!err);
      assert(testThing === piece);
      done();
    });
  });

  it('same thing with promises', function(done) {
    assert(apos.modules['things'].insert);
    apos.modules['things'].insert(apos.tasks.getReq(), testThing2)
      .then(function(piece2) {
        assert(testThing2 === piece2);
        done();
      })
      .catch(function(err) {
        assert(!err);
      });
  });

  // Test pieces.requirePiece()
  it('should be able to retrieve a piece by id from the database', function(done) {
    assert(apos.modules['things'].requirePiece);
    let req = apos.tasks.getReq();
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
    apos.modules['things'].update(apos.tasks.getReq(), testThing, function(err, piece) {
      assert(!err);
      assert(testThing === piece);
      // Now let's get the piece and check if it was updated
      let req = apos.tasks.getReq();
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

  it('same thing with promises', function(done) {
    assert(apos.modules['things'].update);
    testThing.foo = 'goo';
    apos.modules['things'].update(apos.tasks.getReq(), testThing)
      .then(function(piece) {
        assert(testThing === piece);
        // Now let's get the piece and check if it was updated
        let req = apos.tasks.getReq();
        req.body = {};
        req.body._id = "testThing";
        apos.modules['things'].requirePiece(req, req.res, function() {
          assert(req.piece);
          assert(req.piece._id === 'testThing');
          assert(req.piece.foo === 'goo');
          done();
        });
      })
      .catch(function(err) {
        assert(!err);
      });
  });

  // Test pieces.addListFilters()
  it('should only execute filters that are safe and have a launder method', function() {
    let publicTest = false;
    let manageTest = false;
    // addListFilters should execute launder and filters for filter
    // definitions that are safe for 'public' or 'manage' contexts
    let mockCursor = apos.docs.find(apos.tasks.getAnonReq());
    _.merge(mockCursor, {
      builders: {
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
    });

    let filters = {
      publicTest: 'foo',
      manageTest: 'bar',
      unsafeTest: 'nope',
      fakeTest: 'notEvenReal'
    };

    mockCursor.applyBuildersSafely(filters);
    assert(publicTest === true);
    assert(manageTest === true);
  });

  // Test pieces.list()
  it('should add some more things for testing', function(done) {
    assert(apos.modules['things'].insert);
    async.each(additionalThings, function(thing, callback) {
      apos.modules['things'].insert(apos.tasks.getReq(), thing, function(err) {
        callback(err);
      });
    }, function(err) {
      assert(!err);
      done();
    });
  });

  it('should list all the pieces if skip and limit are set to large enough values', function(done) {
    assert(apos.modules['things'].list);
    let req = apos.tasks.getReq();
    let filters = {
      limit: 10,
      skip: 0
    };
    apos.modules['things'].list(req, filters, function(err, results) {
      assert(!err);
      assert(results.total === 5);
      assert(results.limit === 10);
      assert(results.skip === 0);
      assert(results.pieces.length === 5);
      done();
    });
  });

  // pieces.trash()
  it('should be able to trash a piece', function(done) {
    assert(apos.modules['things'].trash);
    assert(apos.modules['things'].requirePiece);
    let req = apos.tasks.getReq();
    let id = 'testThing';
    req.body = {_id: id};
    // let's make sure the piece is not trashed to start
    findPiece(req, id, function(err, piece) {
      assert(!err);
      assert(!piece.trash);
      apos.modules['things'].trash(req, id, function(err) {
        assert(!err);
        // let's get the piece to make sure it is trashed
        findPiece(req, id, function(err, piece) {
          assert(!err);
          assert(piece);
          assert(piece.trash === true);
          done();
        });
      });
    });
  });

  // pieces.rescue()
  it('should be able to rescue a trashed piece', function(done) {
    assert(apos.modules['things'].rescue);
    let req = apos.tasks.getReq();
    let id = 'testThing';
    req.body = {_id: id};
    // let's make sure the piece is trashed to start
    findPiece(req, id, function(err, piece) {
      assert(!err);
      assert(piece.trash === true);
      apos.modules['things'].rescue(req, id, function(err) {
        assert(!err);
        // let's get the piece to make sure it is rescued
        findPiece(req, id, function(err, piece) {
          assert(!err);
          assert(piece);
          assert(!piece.trash);
          done();
        });
      });
    });
  });

  // pieces.apiResponse()
  it('should pass through an error message if the error is passed as a string', function(done) {
    assert(apos.modules['things'].apiResponse);
    let res = apos.tasks.getAnonReq().res;
    let errMsg = "Test Error";
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
    let res = apos.tasks.getAnonReq().res;
    let errMsg = true;
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
    let res = apos.tasks.getAnonReq().res;
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
  let routeThing = {
    title: 'purple',
    foo: 'bar'
  };

  let insertedRouteThing;

  // routes.insert
  it('should insert an item from the routes.insert method', function(done) {
    assert(apos.modules['things'].routes.insert);

    let req = apos.tasks.getReq();
    req.body = routeThing;
    let res = req.res;
    res.send = function(result) {
      assert(result);
      assert(result.status === 'ok');
      assert(result.data);
      assert(result.data._id);
      insertedRouteThing = result.data;
      done();
    };

    return apos.modules['things'].routes.insert(req, res);
  });

  // routes.retrieve
  it('should get an item from the routes.retrieve method', function(done) {
    assert(apos.modules['things'].routes.retrieve);

    let req = apos.tasks.getReq();
    // note we set the req.piece here, because the middleware would do the query nd supply the piece
    req.piece = insertedRouteThing;
    let res = req.res;
    res.send = function(result) {
      assert(result);
      assert(result.status === 'ok');
      assert(result.data.title === 'purple');
      done();
    };

    return apos.modules['things'].routes.retrieve(req, res);
  });

  // routes.list
  it('should get a list of all the items from routes.list', function(done) {
    assert(apos.modules['things'].routes.list);

    let req = apos.tasks.getReq();
    // note we set the req.piece here, because the middleware would do the query nd supply the piece
    req.body = { limit: 10, skip: 0 };
    let res = req.res;
    res.send = function(result) {
      assert(result);
      assert(result.status === 'ok');
      assert(result.data.total === 6);
      assert(result.data.skip === 0);
      assert(result.data.limit === 10);
      assert(result.data.pieces.length === 6);
      done();
    };

    return apos.modules['things'].routes.list(req, res);
  });

  // routes.update
  it('should update an item in the database from route.update', function(done) {
    assert(apos.modules['things'].routes.update);

    // simulate that middleware first
    assert(apos.modules['things'].requirePiece);
    let req = apos.tasks.getReq();
    req.body = insertedRouteThing;
    // make a change to the thing we are inserting
    req.body.title = "blue";
    let res = req.res;
    res.send = function(result) {
      assert(result);
      assert(result.status === 'ok');
      assert(result.data.title === 'blue');
      done();
    };
    apos.modules['things'].requirePiece(req, res, function() {
      return apos.modules['things'].routes.update(req, res);
    });
  });

  // routes.trash
  it('should trash an item in the database from route.trash', function(done) {
    assert(apos.modules['things'].routes.trash);
    assert(apos.modules['things'].requirePiece);

    let req = apos.tasks.getReq();
    let id = insertedRouteThing._id;
    req.body = {_id: id};
    let res = req.res;
    res.send = function(response) {
      assert(response.status === 'ok');
      // let's get the piece to make sure it is trashed
      findPiece(req, id, function(err, piece) {
        assert(!err);
        assert(piece);
        assert(piece.trash === true);
        done();
      });
    };
    // let's make sure the piece is not trashed to start
    findPiece(req, id, function(err, piece) {
      assert(!err);
      assert(!piece.trash);
      apos.modules['things'].routes.trash(req, res);
    });

  });

  // routes.rescue
  it('should rescue an item in the database from route.rescue', function(done) {
    assert(apos.modules['things'].routes.rescue);
    assert(apos.modules['things'].requirePiece);

    let req = apos.tasks.getReq();
    let id = insertedRouteThing._id;
    req.body = {_id: id};
    let res = req.res;
    res.send = function(response) {
      assert(response.status === 'ok');
      // let's get the piece to make sure it no longer trashed
      findPiece(req, id, function(err, piece) {
        assert(!err);
        assert(piece);
        assert(!piece.trash);
        done();
      });
    };
    // let's make sure the piece trashed to start
    findPiece(req, id, function(err, piece) {
      assert(!err);
      assert(piece.trash === true);
      apos.modules['things'].routes.rescue(req, res);
    });

  });

  it('people can find things via a join', function() {
    let req = apos.tasks.getReq();
    return apos.docs.db.insertOne(testPeople)
      .then(function() {
        return apos.docs.getManager('person').find(req, {}).toObject();
      })
      .then(function(person) {
        assert(person);
        assert(person.title === 'Bob');
        assert(person._things);
        assert(person._things.length === 2);
      });
  });

  it('people cannot find things via a join with an inadequate projection', function() {
    let req = apos.tasks.getReq();
    return apos.docs.getManager('person').find(req, {}, {title: 1}).toObject()
      .then(function(person) {
        assert(person);
        assert(person.title === 'Bob');
        assert((!person._things) || (person._things.length === 0));
      });
  });

  it('people can find things via a join with a "projection" of the join name', function() {
    let req = apos.tasks.getReq();
    return apos.docs.getManager('person').find(req, {}, {title: 1, _things: 1}).toObject()
      .then(function(person) {
        assert(person);
        assert(person.title === 'Bob');
        assert(person._things);
        assert(person._things.length === 2);
      });
  });

});
