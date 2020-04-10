const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');
const request = require('request-promise');
const cuid = require('cuid');

let apos;
let jar;

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
          }
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
        },
        'products': {
          extend: 'apostrophe-pieces',
          name: 'product',
          fields: {
            body: {
              type: 'area',
              options: {
                widgets: {
                  'apostrophe-rich-text': {},
                  'apostrophe-images': {}
                }
              }
            },
            color: {
              type: 'select',
              choices: [
                {
                  label: 'Red',
                  value: 'red'
                },
                {
                  label: 'Blue',
                  value: 'blue'
                }
              ]
            },
            photo: {
              type: 'attachment',
              group: 'images'
            },
            addresses: {
              type: 'array',
              schema: {
                street: {
                  type: 'string'
                }
              }
            },
            _articles: {
              type: 'joinByArray',
              filters: {
                projection: {
                  title: 1,
                  slug: 1
                }
              }
            }
          }
        },
        articles: {
          extend: 'apostrophe-pieces',
          fields: {
            name: {
              type: 'string'
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

  it('should be able to insert test user', async function() {
    assert(apos.users.newInstance);
    const user = apos.users.newInstance();
    assert(user);

    user.firstName = 'ad';
    user.lastName = 'min';
    user.title = 'admin';
    user.username = 'admin';
    user.password = 'admin';
    user.email = 'ad@min.com';
    user.permissions = [ 'admin' ];

    return apos.users.insert(apos.tasks.getReq(), user);
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

  it('should be able to log in as admin', async () => {
    jar = request.jar();

    // establish session
    let page = await request({
      uri: 'http://localhost:7900/',
      jar,
      followAllRedirects: true
    });

    assert(page.match(/logged out/));

    // Log in
    await request({
      method: 'POST',
      uri: 'http://localhost:7900/api/v1/apostrophe-login/login',
      json: {
        username: 'admin',
        password: 'admin'
      },
      followAllRedirects: true,
      jar
    });

    // Confirm login
    page = await request({
      uri: 'http://localhost:7900/',
      jar,
      followAllRedirects: true
    });

    assert(page.match(/logged in/));
  });

  it('cannot POST a product without a session', async () => {
    await request('http://localhost:7900/api/v1/products', {
      method: 'POST',
      json: {
        title: 'Fake Product',
        body: {
          type: 'area',
          items: [
            {
              type: 'apostrophe-rich-text',
              id: cuid(),
              content: '<p>This is fake</p>'
            }
          ]
        }
      }
    });
    // Should not get here
    assert(false);
  });

  let updateProduct;

  it('can POST products with a bearer token, some published', async () => {
    // range is exclusive at the top end, I want 10 things
    for (let i = 1; (i <= 10); i++) {
      const response = await request('http://localhost:7900/api/v1/products', {
        method: 'POST',
        json: {
          title: 'Cool Product #' + i,
          published: !!(i & 1),
          body: {
            type: 'area',
            items: [
              {
                type: 'apostrophe-rich-text',
                id: cuid(),
                content: '<p>This is thing ' + i + '</p>'
              }
            ]
          }
        },
        jar
      });
      assert(response);
      assert(response._id);
      assert(response.title === 'Cool Product #' + i);
      assert(response.slug === 'cool-product-' + i);
      assert(response.type === 'product');
      if (i === 1) {
        updateProduct = response;
      }
    }
  });

  it('can GET five of those products without the user session', async () => {
    const response = await request('http://localhost:7900/api/v1/products');
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
  });

  it('can GET five of those products with a user session and no query parameters', async () => {
    const response = await request('http://localhost:7900/api/v1/products', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
  });

  it('can GET all ten of those products with a user session and published: "any"', async () => {
    const response = await request('http://localhost:7900/api/v1/products?published=any', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
  });

  let firstId;

  it('can GET only 5 if perPage is 5', async () => {
    const response = await request('http://localhost:7900/api/v1/products?perPage=5&published=any', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
    firstId = response.results[0]._id;
    assert(response.pages === 2);
  });

  it('can GET a different 5 on page 2', async () => {
    const response = await request('http://localhost:7900/api/v1/products?perPage=5&published=any&page=2', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
    assert(response.results[0]._id !== firstId);
    assert(response.pages === 2);
  });

  it('can update a product', async () => {
    const response = await request(`http://localhost:7900/api/v1/products/${updateProduct._id}`, {
      method: 'PUT',
      json: {
        ...updateProduct,
        title: 'I like cheese',
        _id: 'should-not-change'
      },
      jar
    });
    assert(response);
    assert(response._id === updateProduct._id);
    assert(response.title === 'I like cheese');
    assert(response.body.items.length);
  });

  it('fetch of updated product shows updated content', async () => {
    const response = await request(`http://localhost:7900/api/v1/products/${updateProduct._id}`, {
      jar
    });
    assert(response);
    assert(response._id === updateProduct._id);
    assert(response.title === 'I like cheese');
    assert(response.body.items.length);
  });

  it('can delete a product', async () => {
    return request(`http://localhost:7900/api/v1/products/${updateProduct._id}`, {
      method: 'DELETE'
    });
  });

  it('cannot fetch a deleted product', function(done) {
    it('fetch of updated product shows updated content', async () => {
      const response = await request(`http://localhost:7900/api/v1/products/${updateProduct._id}`, {
        jar
      });
      // Should have been a 404, 200 = test fails
      assert(false);
    });
  });

  let joinedProductId;

  it('can insert a product with joins', async () => {
    let response = await request('http://localhost:7900/api/v1/articles', {
      method: 'POST',
      json: {
        title: 'First Article',
        name: 'first-article'
      },
      jar
    });
    const articleId = response._id;
    assert(articleId);

    response = await request('http://localhost:7900/api/v1/products', {
      method: 'POST',
      json: {
        title: 'Product Key Product With Join',
        body: {
          type: 'area',
          items: [
            {
              type: 'apostrophe-rich-text',
              id: cuid(),
              content: '<p>This is the product key product with join</p>'
            }
          ]
        },
        articlesIds: [articleId]
      }
    });
    assert(response._id);
    assert(response.articlesIds[0] === articleId);
    joinedProductId = response._id;
  });

  it('can GET a product with joins', async () => {
    const response = await request('http://localhost:7900/api/v1/products');
    assert(response);
    assert(response.results);
    var product = _.find(response.results, { slug: 'product-key-product-with-join' });
    assert(Array.isArray(product['_articles']));
    assert(product['_articles'].length === 1);
  });

  it('can GET a single product with joins', async () => {
    const response = await request(`http://localhost:7900/api/v1/products/${joinedProductId}`);
    assert(response);
    assert(response._articles);
    assert(response._articles.length === 1);
  });

  it('can GET results with distinct article join information', async () => {
    const response = await request('http://localhost:7900/api/v1/products?distinct=_articles', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.distinct);
    assert(response.distinct._articles);
    assert(response.distinct._articles[0].label === 'First Article');
  });

  it('can GET results with distinct article join information', async () => {
    const response = await request('http://localhost:7900/api/v1/products?distinct-counts=_articles', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.distinct);
    assert(response.distinct._articles);
    assert(response.distinct._articles[0].label === 'First Article');
    assert(response.distinct._articles[0].count === 1);
  });

  it('can patch a join', async () => {
    let response = await request('http://localhost:7900/api/v1/articles', {
      method: 'POST',
      jar,
      json: {
        title: 'Join Article',
        name: 'join-article'
      }
    });
    const articleId = response._id;
    assert(articleId);

    response = await request('http://localhost:7900/api/v1/products', {
      method: 'POST',
      jar,
      json: {
        title: 'Initially No Join Value',
        body: {
          type: 'area',
          items: [
            {
              type: 'apostrophe-rich-text',
              id: cuid(),
              content: '<p>This is the product key product without initial join</p>'
            }
          ]
        }
      }
    });

    const product = response;
    assert(product._id);
    response = await request(`http://localhost:7900/api/v1/products/${product._id}`, {
      method: 'PATCH',
      json: {
        articlesIds: [ articleId ]
      }
    });
    assert(response.title === 'Initially No Join Value');
    assert(response.articlesIds);
    assert(response.articlesIds[0] === articleId);
  });

  it('can log out to destroy a session', async () => {
   return request({
      method: 'POST',
      uri: 'http://localhost:7900/api/v1/apostrophe-login/logout',
      json: {},
      followAllRedirects: true,
      jar
    });
  });

  it('cannot POST a product with a logged-out bearer token', async () => {
    await request('http://localhost:7900/api/v1/products', {
      method: 'POST',
      json: {
        title: 'Fake Product After Logout',
        body: {
          type: 'area',
          items: [
            {
              type: 'apostrophe-rich-text',
              id: cuid(),
              content: '<p>This is fake</p>'
            }
          ]
        }
      },
      jar
    });
    assert(false);
  });
});
