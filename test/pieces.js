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

  it('should initialize with a schema', async () => {
    apos = await (require('../index.js')({
      root: module,
      argv: {
        _: []
      },
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          options: {
            secret: 'xxx',
            port: 7900
          },
        },
        'things': {
          extend: 'apostrophe-pieces',
          options: {
            name: 'thing',
            label: 'Thing',
            addFields: {
              name: 'foo',
              label: 'Foo',
              type: 'string'
            }
          }
        },
        'people': {
          extend: 'apostrophe-pieces',
          options: {
            name: 'person',
            label: 'Person',
            addFields: {
              name: '_things',
              type: 'joinByArray'
            }
          }
        }
      }
    }));
    assert(apos.modules['things']);
    assert(apos.modules['things'].schema);
  });

  // little test-helper function to get piece by id regardless of trash status
  async function findPiece(req, id) {
    const piece = apos.modules['things'].find(req, { _id: id })
      .permission('edit')
      .published(null)
      .trash(null)
      .toObject();
    if (!piece) {
      throw 'notfound';
    }
    return piece;
  }

  let testThing = {
    _id: 'testThing',
    title: 'hello',
    foo: 'bar'
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
  it('should make sure there is no test data hanging around from last time', async function() {
    // Attempt to purge the entire aposDocs collection
    await apos.docs.db.deleteMany({});
    // Make sure it went away
    const docs = await apos.docs.db.find({ _id: 'testThing' }).toArray();
    assert(docs.length === 0);
  });

  // Test pieces.newInstance()
  it('should be able to create a new piece', function() {
    assert(apos.modules['things'].newInstance);
    let thing = apos.modules['things'].newInstance();
    assert(thing);
    assert(thing.type === 'thing');
  });

  // Test pieces.insert()
  it('should be able to insert a piece into the database', async () => {
    assert(apos.modules['things'].insert);
    await apos.modules['things'].insert(apos.tasks.getReq(), testThing);
  });

  it('should be able to retrieve a piece by id from the database', async () => {
    assert(apos.modules['things'].requireOneForEditing);
    let req = apos.tasks.getReq();
    req.piece = await apos.modules['things'].requireOneForEditing(req, { _id: 'testThing' });
    assert(req.piece);
    assert(req.piece._id === 'testThing');
    assert(req.piece.title === 'hello');
    assert(req.piece.foo === 'bar');
  });

  // Test pieces.update()
  it('should be able to update a piece in the database', async () => {
    assert(apos.modules['things'].update);
    testThing.foo = 'moo';
    const piece = await apos.modules['things'].update(apos.tasks.getReq(), testThing);
    assert(testThing === piece);
    // Now let's get the piece and check if it was updated
    let req = apos.tasks.getReq();
    req.piece = await apos.modules['things'].requireOneForEditing(req, { _id: 'testThing' });
    assert(req.piece);
    assert(req.piece._id === 'testThing');
    assert(req.piece.foo === 'moo');
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

    mockCursor.applySafeBuilders(filters);
    assert(publicTest === true);
    assert(manageTest === true);
  });

  // Test pieces.list()
  it('should add some more things for testing', async () => {
    assert(apos.modules['things'].insert);
    for (const thing of additionalThings) {
      await apos.modules['things'].insert(apos.tasks.getReq(), thing);
    }
  });

  it('should list all the pieces if skip and limit are set to large enough values', async () => {
    assert(apos.modules['things'].list);
    let req = apos.tasks.getReq();
    let filters = {
      limit: 10,
      skip: 0
    };
    const results = await apos.modules['things'].list(req, filters);
    assert(results.total === 5);
    assert(results.limit === 10);
    assert(results.skip === 0);
    assert(results.pieces.length === 5);
  });

  // pieces.trash()
  it('should be able to trash a piece', async () => {
    assert(apos.modules['things'].trash);
    assert(apos.modules['things'].requireOneForEditing);
    let req = apos.tasks.getReq();
    let id = 'testThing';
    req.body = {_id: id};
    // let's make sure the piece is not trashed to start
    const piece = await findPiece(req, id);
    assert(!piece.trash);
    await apos.modules['things'].trash(req, id);
    // let's get the piece to make sure it is trashed
    const piece2 = findPiece(req, id);
    assert(piece2);
    assert(piece2.trash === true);
  });

  // pieces.rescue()
  it('should be able to rescue a trashed piece', async () => {
    assert(apos.modules['things'].rescue);
    let req = apos.tasks.getReq();
    let id = 'testThing';
    req.body = {
      _id: id
    };
    // let's make sure the piece is trashed to start
    const piece = await findPiece(req, id);
    assert(piece.trash === true);
    await apos.modules['things'].rescue(req, id);
    const piece2 = await findPiece(req, id);
    assert(piece2);
    assert(!piece2.trash);
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
