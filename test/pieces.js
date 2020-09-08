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
        things: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'things',
            name: 'thing',
            label: 'Thing',
            publicApiProjection: {
              title: 1,
              _url: 1
            }
          },
          fields: {
            add: {
              foo: {
                label: 'Foo',
                type: 'string'
              }
            }
          }
        },
        people: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'people',
            name: 'person',
            label: 'Person',
            publicApiProjection: {
              title: 1,
              _url: 1
            }
          },
          fields: {
            add: {
              _things: {
                type: 'relationship'
              }
            }
          }
        },
        product: {
          extend: '@apostrophecms/piece-type',
          options: {
            publicApiProjection: {
              title: 1,
              _url: 1,
              _articles: 1
            }
          },
          fields: {
            add: {
              body: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    '@apostrophecms/image': {}
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
                fields: {
                  add: {
                    street: {
                      type: 'string'
                    }
                  }
                }
              },
              _articles: {
                type: 'relationship',
                withType: 'article',
                filters: {
                  projection: {
                    _url: 1,
                    title: 1
                  }
                },
                fields: {
                  add: {
                    relevance: {
                      // Explains the relevance of the article to the
                      // product in 1 sentence
                      type: 'string'
                    }
                  }
                }
              }
            }
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            publicApiProjection: {
              title: 1,
              _url: 1
            }
          },
          fields: {
            add: {
              name: {
                type: 'string'
              },
              _products: {
                type: 'relationshipReverse',
                withType: 'product'
              }
            }
          }
        }
      }
    });
    assert(apos.modules.things);
    assert(apos.modules.things.schema);
  });

  // little test-helper function to get piece by id regardless of trash status
  async function findPiece(req, id) {
    const piece = apos.modules.things.find(req, { _id: id })
      .permission('edit')
      .published(null)
      .trash(null)
      .toObject();
    if (!piece) {
      throw apos.error('notfound');
    }
    return piece;
  }

  const testThing = {
    _id: 'testThing',
    title: 'hello',
    foo: 'bar'
  };

  const additionalThings = [
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

  const testPeople = [
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
    assert(apos.modules.things.newInstance);
    const thing = apos.modules.things.newInstance();
    assert(thing);
    assert(thing.type === 'thing');
  });

  // Test pieces.insert()
  it('should be able to insert a piece into the database', async () => {
    assert(apos.modules.things.insert);
    await apos.modules.things.insert(apos.task.getReq(), testThing);
  });

  it('should be able to retrieve a piece by id from the database', async () => {
    assert(apos.modules.things.requireOneForEditing);
    const req = apos.task.getReq();
    req.piece = await apos.modules.things.requireOneForEditing(req, { _id: 'testThing' });
    assert(req.piece);
    assert(req.piece._id === 'testThing');
    assert(req.piece.title === 'hello');
    assert(req.piece.foo === 'bar');
  });

  // Test pieces.update()
  it('should be able to update a piece in the database', async () => {
    assert(apos.modules.things.update);
    testThing.foo = 'moo';
    const piece = await apos.modules.things.update(apos.task.getReq(), testThing);
    assert(testThing === piece);
    // Now let's get the piece and check if it was updated
    const req = apos.task.getReq();
    req.piece = await apos.modules.things.requireOneForEditing(req, { _id: 'testThing' });
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
    const mockCursor = apos.doc.find(apos.task.getAnonReq());
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

    const filters = {
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
    assert(apos.modules.things.requireOneForEditing);
    const req = apos.task.getReq();
    const id = 'testThing';
    req.body = { _id: id };
    // let's make sure the piece is not trashed to start
    const piece = await findPiece(req, id);
    assert(!piece.trash);
    piece.trash = true;
    await apos.modules.things.update(req, piece);
    // let's get the piece to make sure it is trashed
    const piece2 = await findPiece(req, id);
    assert(piece2);
    assert(piece2.trash === true);
    assert(piece2.aposWasTrash === true);
    assert(piece2.slug === 'deduplicate-testThing-hello');
  });

  it('should be able to rescue a trashed piece with proper deduplication', async () => {
    const req = apos.task.getReq();
    const id = 'testThing';
    req.body = {
      _id: id
    };
    // let's make sure the piece is trashed to start
    const piece = await findPiece(req, id);
    assert(piece.trash === true);
    piece.trash = false;
    await apos.modules.things.update(req, piece);
    const piece2 = await findPiece(req, id);
    assert(piece2);
    assert(!piece2.trash);
    assert(!piece2.aposWasTrash);
    assert(piece2.slug === 'hello');
  });

  it('should be able to insert test user', async function() {
    assert(apos.user.newInstance);
    const user = apos.user.newInstance();
    assert(user);

    user.firstName = 'ad';
    user.lastName = 'min';
    user.title = 'admin';
    user.username = 'admin';
    user.password = 'admin';
    user.email = 'ad@min.com';
    user.permissions = [ 'admin' ];

    return apos.user.insert(apos.task.getReq(), user);
  });

  it('people can find things via a relationship', async () => {
    const req = apos.task.getReq();
    for (const person of testPeople) {
      await apos.people.insert(req, person);
    }
    for (const thing of additionalThings) {
      await apos.things.insert(req, thing);
    }
    const person = await apos.doc.getManager('person').find(req, {}).toObject();
    assert(person);
    assert(person.title === 'Bob');
    assert(person._things);
    assert(person._things.length === 2);
  });

  it('people cannot find things via a relationship with an inadequate projection', function() {
    const req = apos.task.getReq();
    return apos.doc.getManager('person').find(req, {}, {
      // Use the options object rather than a chainable method
      project: {
        title: 1
      }
    }).toObject()
      .then(function(person) {
        assert(person);
        assert(person.title === 'Bob');
        // Verify projection
        assert(!person.slug);
        assert((!person._things) || (person._things.length === 0));
      });
  });

  it('people can find things via a relationship with a "projection" of the relationship name', function() {
    const req = apos.task.getReq();
    return apos.doc.getManager('person').find(req, {}, {
      project: {
        title: 1,
        _things: 1
      }
    }).toObject()
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
      await apos.http.post('/api/v1/product', {
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
      const response = await apos.http.post('/api/v1/product', {
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
      assert(response.type === 'product');
      if (i === 1) {
        updateProduct = response;
      }
    }
  });

  it('can GET five of those products without the user session', async () => {
    const response = await apos.http.get('/api/v1/product');
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
  });

  it('can GET five of those products with a user session and no query parameters', async () => {
    const response = await apos.http.get('/api/v1/product', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
  });

  it('can GET all ten of those products with a user session and published=any', async () => {
    const response = await apos.http.get('/api/v1/product?published=any', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 10);
  });

  let firstId;

  it('can GET only 5 if perPage is 5', async () => {
    const response = await apos.http.get('/api/v1/product?perPage=5&published=any', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
    firstId = response.results[0]._id;
    assert(response.pages === 2);
  });

  it('can GET a different 5 on page 2', async () => {
    const response = await apos.http.get('/api/v1/product?perPage=5&page=2&published=any', {
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
    const response = await apos.http.put(`/api/v1/product/${updateProduct._id}`, args);
    assert(response);
    assert(response._id === updateProduct._id);
    assert(response.title === 'I like cheese');
    assert(response.body.items.length);
  });

  it('fetch of updated product shows updated content', async () => {
    const response = await apos.http.get(`/api/v1/product/${updateProduct._id}`, {
      jar
    });
    assert(response);
    assert(response._id === updateProduct._id);
    assert(response.title === 'I like cheese');
    assert(response.body.items.length);
  });

  it('can trash a product', async () => {
    return apos.http.patch(`/api/v1/product/${updateProduct._id}`, {
      body: {
        trash: true
      },
      jar
    });
  });

  it('cannot fetch a trashed product', async () => {
    try {
      await apos.http.get(`/api/v1/product/${updateProduct._id}`, {
        jar
      });
      // Should have been a 404, 200 = test fails
      assert(false);
    } catch (e) {
      assert(e.status === 404);
    }
  });

  it('can fetch trashed product with trash=any and the right user', async () => {
    const product = await apos.http.get(`/api/v1/product/${updateProduct._id}?trash=any`, {
      jar
    });
    // Should have been a 404, 200 = test fails
    assert(product.trash);
  });

  let relatedProductId;

  it('can insert a product with relationships', async () => {
    let response = await apos.http.post('/api/v1/article', {
      body: {
        title: 'First Article',
        name: 'first-article'
      },
      jar
    });
    const article = response;
    assert(article);
    assert(article.title === 'First Article');
    article._fields = {
      relevance: 'The very first article that was ever published about this product'
    };
    response = await apos.http.post('/api/v1/product', {
      body: {
        title: 'Product Key Product With Relationship',
        body: {
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              id: cuid(),
              content: '<p>This is the product key product with relationship</p>'
            }
          ]
        },
        _articles: [ article ]
      },
      jar
    });
    assert(response._id);
    assert(response.articlesIds[0] === article._id);
    assert(response.articlesFields[article._id].relevance === 'The very first article that was ever published about this product');
    relatedProductId = response._id;
  });

  it('can GET a product with relationships', async () => {
    const response = await apos.http.get('/api/v1/product');
    assert(response);
    assert(response.results);
    const product = _.find(response.results, { slug: 'product-key-product-with-relationship' });
    assert(Array.isArray(product._articles));
    assert(product._articles.length === 1);
  });

  let relatedArticleId;

  it('can GET a single product with relationships', async () => {
    const response = await apos.http.get(`/api/v1/product/${relatedProductId}`);
    assert(response);
    assert(response._articles);
    assert(response._articles.length === 1);
    relatedArticleId = response._articles[0]._id;
  });

  it('can GET a single article with reverse relationships', async () => {
    const response = await apos.http.get(`/api/v1/article/${relatedArticleId}`);
    assert(response);
    assert(response._products);
    assert(response._products.length === 1);
    assert(response._products[0]._id === relatedProductId);
  });

  it('can GET results plus filter choices', async () => {
    const response = await apos.http.get('/api/v1/product?choices=title,published,_articles,articles', {
      jar
    });
    assert(response);
    assert(response.results);
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
    const response = await apos.http.get('/api/v1/product?_edit=1&counts=title,published,_articles,articles', {
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

  it('can patch a relationship', async () => {
    let response = await apos.http.post('/api/v1/article', {
      jar,
      body: {
        title: 'Relationship Article',
        name: 'relationship-article'
      }
    });
    const article = response;
    assert(article);
    assert(article.title === 'Relationship Article');

    response = await apos.http.post('/api/v1/product', {
      jar,
      body: {
        title: 'Initially No Relationship Value',
        body: {
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              id: cuid(),
              content: '<p>This is the product key product without initial relationship</p>'
            }
          ]
        }
      }
    });

    const product = response;
    assert(product._id);
    response = await apos.http.patch(`/api/v1/product/${product._id}`, {
      body: {
        _articles: [ article ]
      },
      jar
    });
    assert(response.title === 'Initially No Relationship Value');
    assert(response.articlesIds);
    assert(response.articlesIds[0] === article._id);
    assert(response._articles);
    assert(response._articles[0]._id === article._id);
  });

  it('can log out to destroy a session', async () => {
    return apos.http.post('/api/v1/@apostrophecms/login/logout', {
      followAllRedirects: true,
      jar
    });
  });

  it('cannot POST a product with a logged-out cookie jar', async () => {
    try {
      await apos.http.post('/api/v1/product', {
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
