const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');
const cuid = require('cuid');

let apos;
let jar;

describe('Pieces', function() {

  this.timeout(t.timeout);

  after(async function () {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize with a schema', async () => {
    apos = await t.create({
      root: module,

      modules: {
        'things': {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'things',
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
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'people',
            name: 'person',
            label: 'Person',
            addFields: {
              name: '_things',
              type: 'joinByArray'
            }
          }
        },
        'products': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              body: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    '@apostrophecms/images': {}
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
                withType: 'article',
                filters: {
                  projection: {
                    title: 1,
                    slug: 1
                  }
                }
              }
            }
          }
        },
        articles: {
          extend: '@apostrophecms/piece-type',
          options: {
            name: 'article'
          },
          fields: {
            add: {
              name: {
                type: 'string'
              }
            }
          }
        }
      }
    });
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
      throw apos.error('notfound');
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
          }
        },
        manageTest: {
          launder: function(s) {
            return 'laundered';
          }
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

  it('should be able to trash a piece with proper deduplication', async () => {
    assert(apos.modules['things'].requireOneForEditing);
    let req = apos.tasks.getReq();
    let id = 'testThing';
    req.body = { _id: id };
    // let's make sure the piece is not trashed to start
    const piece = await findPiece(req, id);
    assert(!piece.trash);
    piece.trash = true;
    await apos.modules['things'].update(req, piece);
    // let's get the piece to make sure it is trashed
    const piece2 = await findPiece(req, id);
    assert(piece2);
    assert(piece2.trash === true);
    assert(piece2.aposWasTrash === true);
    assert(piece2.slug === 'deduplicate-testThing-hello');
  });

  it('should be able to rescue a trashed piece with proper deduplication', async () => {
    let req = apos.tasks.getReq();
    let id = 'testThing';
    req.body = {
      _id: id
    };
    // let's make sure the piece is trashed to start
    const piece = await findPiece(req, id);
    assert(piece.trash === true);
    piece.trash = false;
    await apos.modules['things'].update(req, piece);
    const piece2 = await findPiece(req, id);
    assert(piece2);
    assert(!piece2.trash);
    assert(!piece2.aposWasTrash);
    assert(piece2.slug === 'hello');
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

  it('people can find things via a join', async () => {
    let req = apos.tasks.getReq();
    for (const person of testPeople) {
      await apos.people.insert(req, person);
    }
    for (const thing of additionalThings) {
      await apos.things.insert(req, thing);
    }
    const person = await apos.docs.getManager('person').find(req, {}).toObject();
    assert(person);
    assert(person.title === 'Bob');
    assert(person._things);
    assert(person._things.length === 2);
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
    jar = apos.http.jar();

    // establish session
    let page = await apos.http.get('/', {
      jar
    });

    assert(page.match(/logged out/));

    // Log in

    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin'
      },
      jar
    });

    // Confirm login
    page = await apos.http.get('/', {
      jar
    });

    assert(page.match(/logged in/));
  });

  it('cannot POST a product without a session', async () => {
    try {
      await apos.http.post('/api/v1/products', {
        body: {
          title: 'Fake Product',
          body: {
            metaType: 'area',
            items: [
              {
                metaType: 'widget',
                type: '@apostrophecms/rich-text',
                id: cuid(),
                content: '<p>This is fake</p>'
              }
            ]
          }
        }
      });
      // Should not get here
      assert(false);
    } catch (e) {
      assert(e.status === 403);
    }
  });

  let updateProduct;

  it('can POST products with a session, some published', async () => {
    // range is exclusive at the top end, I want 10 things
    for (let i = 1; (i <= 10); i++) {
      const response = await apos.http.post('/api/v1/products', {
        body: {
          title: 'Cool Product #' + i,
          published: !!(i & 1),
          body: {
            metaType: 'area',
            items: [
              {
                metaType: 'widget',
                type: '@apostrophecms/rich-text',
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
      assert(response.body);
      assert(response.title === 'Cool Product #' + i);
      assert(response.slug === 'cool-product-' + i);
      assert(response.type === 'products');
      if (i === 1) {
        updateProduct = response;
      }
    }
  });

  it('can GET five of those products without the user session', async () => {
    const response = await apos.http.get('/api/v1/products');
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
  });

  it('can GET five of those products with a user session and no query parameters', async () => {
    const response = await apos.http.get('/api/v1/products', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
  });

  it('can GET all ten of those products with a user session and published=any', async () => {
    const response = await apos.http.get('/api/v1/products?published=any', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 10);
  });

  let firstId;

  it('can GET only 5 if perPage is 5', async () => {
    const response = await apos.http.get('/api/v1/products?perPage=5&published=any', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
    firstId = response.results[0]._id;
    assert(response.pages === 2);
  });

  it('can GET a different 5 on page 2', async () => {
    const response = await apos.http.get('/api/v1/products?perPage=5&page=2&published=any', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
    assert(response.results[0]._id !== firstId);
    assert(response.pages === 2);
  });

  it('can update a product with PUT', async () => {
    const args = {
      body: {
        ...updateProduct,
        title: 'I like cheese',
        _id: 'should-not-change'
      },
      jar
    };
    const response = await apos.http.put(`/api/v1/products/${updateProduct._id}`, args);
    assert(response);
    assert(response._id === updateProduct._id);
    assert(response.title === 'I like cheese');
    assert(response.body.items.length);
  });

  it('fetch of updated product shows updated content', async () => {
    const response = await apos.http.get(`/api/v1/products/${updateProduct._id}`, {
      jar
    });
    assert(response);
    assert(response._id === updateProduct._id);
    assert(response.title === 'I like cheese');
    assert(response.body.items.length);
  });

  it('can trash a product', async () => {
    return apos.http.patch(`/api/v1/products/${updateProduct._id}`, {
      body: {
        trash: true
      },
      jar
    });
  });

  it('cannot fetch a trashed product', async () => {
    try {
      await apos.http.get(`/api/v1/products/${updateProduct._id}`, {
        jar
      });
      // Should have been a 404, 200 = test fails
      assert(false);
    } catch (e) {
      assert(e.status === 404);
    }
  });

  it('can fetch trashed product with trash=any and the right user', async () => {
    const product = await apos.http.get(`/api/v1/products/${updateProduct._id}?trash=any`, {
      jar
    });
    // Should have been a 404, 200 = test fails
    assert(product.trash);
  });

  let joinedProductId;

  it('can insert a product with joins', async () => {
    let response = await apos.http.post('/api/v1/articles', {
      body: {
        title: 'First Article',
        name: 'first-article'
      },
      jar
    });
    const articleId = response._id;
    assert(articleId);

    response = await apos.http.post('/api/v1/products', {
      body: {
        title: 'Product Key Product With Join',
        body: {
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              id: cuid(),
              content: '<p>This is the product key product with join</p>'
            }
          ]
        },
        articlesIds: [articleId]
      },
      jar
    });
    assert(response._id);
    assert(response.articlesIds[0] === articleId);
    joinedProductId = response._id;
  });

  it('can GET a product with joins', async () => {
    const response = await apos.http.get('/api/v1/products');
    assert(response);
    assert(response.results);
    const product = _.find(response.results, { slug: 'product-key-product-with-join' });
    assert(Array.isArray(product['_articles']));
    assert(product['_articles'].length === 1);
  });

  it('can GET a single product with joins', async () => {
    const response = await apos.http.get(`/api/v1/products/${joinedProductId}`);
    assert(response);
    assert(response._articles);
    assert(response._articles.length === 1);
  });

  it('can GET results plus filter choices', async () => {
    const response = await apos.http.get('/api/v1/products?choices=title,published,_articles,articles', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.choices);
    assert(response.choices.title);
    assert(response.choices.title[0].label.match(/Cool Product/));
    assert(response.choices.published);
    assert(response.choices.published[0].value === '0');
    assert(response.choices.published[1].value === '1');
    assert(response.choices._articles);
    assert(response.choices._articles[0].label === 'First Article');
    // an _id
    assert(response.choices._articles[0].value.match(/^c/));
    assert(response.choices.articles[0].label === 'First Article');
    // a slug
    assert(response.choices.articles[0].value === 'first-article');
  });

  it('can GET results plus filter counts', async () => {
    const response = await apos.http.get('/api/v1/products?_edit=1&counts=title,published,_articles,articles', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.counts);
    assert(response.counts.title);
    assert(response.counts.title[0].label.match(/Cool Product/));
    // Doesn't work for every field type, but does for this
    assert(response.counts.title[0].count === 1);
    assert(response.counts.published);
    assert(response.counts.published[0].value === '0');
    assert(response.counts.published[1].value === '1');
    assert(response.counts._articles);
    assert(response.counts._articles[0].label === 'First Article');
    // an _id
    assert(response.counts._articles[0].value.match(/^c/));
    assert(response.counts.articles[0].label === 'First Article');
    // a slug
    assert(response.counts.articles[0].value === 'first-article');
  });

  it('can patch a join', async () => {
    let response = await apos.http.post('/api/v1/articles', {
      jar,
      body: {
        title: 'Join Article',
        name: 'join-article'
      }
    });
    const articleId = response._id;
    assert(articleId);

    response = await apos.http.post('/api/v1/products', {
      jar,
      body: {
        title: 'Initially No Join Value',
        body: {
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              id: cuid(),
              content: '<p>This is the product key product without initial join</p>'
            }
          ]
        }
      }
    });

    const product = response;
    assert(product._id);
    response = await apos.http.patch(`/api/v1/products/${product._id}`, {
      body: {
        articlesIds: [ articleId ]
      },
      jar
    });
    assert(response.title === 'Initially No Join Value');
    assert(response.articlesIds);
    assert(response.articlesIds[0] === articleId);
  });

  it('can log out to destroy a session', async () => {
    return apos.http.post('/api/v1/@apostrophecms/login/logout', {
      followAllRedirects: true,
      jar
    });
  });

  it('cannot POST a product with a logged-out cookie jar', async () => {
    try {
      await apos.http.post('/api/v1/products', {
        body: {
          title: 'Fake Product After Logout',
          body: {
            metaType: 'area',
            items: [
              {
                metaType: 'widget',
                type: '@apostrophecms/rich-text',
                id: cuid(),
                content: '<p>This is fake</p>'
              }
            ]
          }
        },
        jar
      });
      assert(false);
    } catch (e) {
      assert(e.status === 403);
    }
  });
});
