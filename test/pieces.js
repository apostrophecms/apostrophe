const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');
const cuid = require('cuid');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

let apos;
let jar;
const apiKey = 'this is a test api key';

describe('Pieces', function() {

  this.timeout(t.timeout);

  after(async function () {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize with a schema', async function() {
    apos = await t.create({
      root: module,

      modules: {
        '@apostrophecms/express': {
          options: {
            apiKeys: {
              [apiKey]: {
                role: 'admin'
              }
            }
          }
        },
        thing: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'thing',
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
        person: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'person',
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
              },
              _tools: {
                type: 'relationship',
                withType: 'thing',
                fields: {
                  add: {
                    skillLevel: {
                      type: 'integer'
                    }
                  }
                }
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
              _articles: 1,
              relationshipsInArray: 1,
              relationshipsInObject: 1
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
              _articles: {
                type: 'relationship',
                withType: 'article',
                builders: {
                  project: {
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
              },
              relationshipsInArray: {
                type: 'array',
                fields: {
                  add: {
                    _articles: {
                      type: 'relationship',
                      withType: 'article'
                    }
                  }
                }
              },
              relationshipsInObject: {
                type: 'object',
                fields: {
                  add: {
                    _articles: {
                      type: 'relationship',
                      withType: 'article'
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
        },
        constrained: {
          options: {
            alias: 'constrained'
          },
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              description: {
                type: 'string',
                min: 5,
                max: 10
              }
            }
          }
        },
        resume: {
          options: {
            alias: 'resume'
          },
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              attachment: {
                type: 'attachment',
                required: true
              }
            }
          }
        }
      }
    });
    assert(apos.modules.thing);
    assert(apos.modules.thing.schema);
  });

  // little test-helper function to get piece by id regardless of archive status
  async function findPiece(req, id) {
    const piece = apos.modules.thing.find(req, { _id: id })
      .permission('edit')
      .archived(null)
      .toObject();
    if (!piece) {
      throw apos.error('notfound');
    }
    return piece;
  }

  const testThing = {
    _id: 'testThing:en:published',
    aposDocId: 'testThing',
    aposLocale: 'en:published',
    title: 'hello',
    foo: 'bar'
  };

  let insertedOne, insertedTwo;

  const additionalThings = [
    {
      _id: 'thing1:en:published',
      title: 'Red'
    },
    {
      _id: 'thing2:en:published',
      title: 'Blue'
    },
    {
      _id: 'thing3:en:published',
      title: 'Green'
    }
  ];

  const testPeople = [
    {
      _id: 'person1:en:published',
      title: 'Bob',
      type: 'person',
      thingsIds: [ 'thing2', 'thing3' ]
    }
  ];

  // Test pieces.newInstance()
  it('should be able to create a new piece', function() {
    assert(apos.modules.thing.newInstance);
    const thing = apos.modules.thing.newInstance();
    assert(thing);
    assert(thing.type === 'thing');
  });

  // Test pieces.insert()
  it('should be able to insert a piece into the database', async function() {
    assert(apos.modules.thing.insert);
    insertedOne = await apos.modules.thing.insert(apos.task.getReq(), testThing);
  });

  it('should be able to insert a second piece into the database', async function() {
    assert(apos.modules.thing.insert);
    const template = { ...testThing };
    template._id = null;
    template.aposDocId = null;
    template.title = 'hello #2';
    insertedTwo = await apos.modules.thing.insert(apos.task.getReq(), template);
  });

  it('should be able to retrieve a piece by id from the database', async function() {
    assert(apos.modules.thing.requireOneForEditing);
    const req = apos.task.getReq();
    req.piece = await apos.modules.thing.requireOneForEditing(req, { _id: 'testThing:en:published' });
    assert(req.piece);
    assert(req.piece._id === 'testThing:en:published');
    assert(req.piece.title === 'hello');
    assert(req.piece.foo === 'bar');
  });

  it('should be able to retrieve the next piece from the database per sort order', async function() {
    const req = apos.task.getReq();
    // The default sort order is reverse chronological, so "next" is older, not newer
    const next = await apos.modules.thing.find(req).next(insertedTwo).toObject();
    assert(next.title === 'hello');
  });

  it('should be able to retrieve the previous piece from the database', async function() {
    const req = apos.task.getReq();
    // The default sort order is reverse chronological, so "previous" is newer, not older
    const previous = await apos.modules.thing.find(req).previous(insertedOne).toObject();
    assert(previous.title === 'hello #2');
  });

  // Test pieces.update()
  it('should be able to update a piece in the database', async function() {
    assert(apos.modules.thing.update);
    testThing.foo = 'moo';
    const piece = await apos.modules.thing.update(apos.task.getReq(), testThing);
    assert(testThing === piece);
    // Now let's get the piece and check if it was updated
    const req = apos.task.getReq();
    req.piece = await apos.modules.thing.requireOneForEditing(req, { _id: 'testThing:en:published' });
    assert(req.piece);
    assert(req.piece._id === 'testThing:en:published');
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

  it('should be able to archive a piece with proper deduplication', async function() {
    assert(apos.modules.thing.requireOneForEditing);
    const req = apos.task.getReq();
    const id = 'testThing:en:published';
    req.body = { _id: id };
    // let's make sure the piece is not archived to start
    const piece = await findPiece(req, id);
    assert(!piece.archived);
    piece.archived = true;
    await apos.modules.thing.update(req, piece);
    // let's get the piece to make sure it is archived
    const piece2 = await findPiece(req, id);
    assert(piece2);
    assert(piece2.archived === true);
    assert(piece2.aposWasArchived === true);
    assert.equal(piece2.slug, 'deduplicate-testThing-hello');
  });

  it('should be able to rescue a archived piece with proper deduplication', async function() {
    const req = apos.task.getReq();
    const id = 'testThing:en:published';
    req.body = {
      _id: id
    };
    // let's make sure the piece is archived to start
    const piece = await findPiece(req, id);
    assert(piece.archived === true);
    piece.archived = false;
    await apos.modules.thing.update(req, piece);
    const piece2 = await findPiece(req, id);
    assert(piece2);
    assert(!piece2.archived);
    assert(!piece2.aposWasArchived);
    assert(piece2.slug === 'hello');
  });

  it('should be able to insert test users', async function() {
    assert(apos.user.newInstance);
    const user = apos.user.newInstance();
    assert(user);

    user.title = 'admin';
    user.username = 'admin';
    user.password = 'admin';
    user.email = 'ad@min.com';
    user.role = 'admin';

    await apos.user.insert(apos.task.getReq(), user);

    const user2 = apos.user.newInstance();
    user2.title = 'admin2';
    user2.username = 'admin2';
    user2.password = 'admin2';
    user2.email = 'ad@min2.com';
    user2.role = 'admin';

    return apos.user.insert(apos.task.getReq(), user2);

  });

  it('people can find things via a relationship', async function() {
    const req = apos.task.getReq();
    for (const person of testPeople) {
      await apos.person.insert(req, person);
    }
    for (const thing of additionalThings) {
      await apos.thing.insert(req, thing);
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

  it('should be able to log in as admin', async function() {
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
        password: 'admin',
        session: true
      },
      jar
    });

    // Confirm login
    page = await apos.http.get('/', {
      jar
    });

    assert(page.match(/logged in/));
  });

  it('can attach a tool to a person via the REST API', async function() {
    const person1 = await apos.http.get('/api/v1/person/person1:en:published');
    assert(person1);
    const thing1 = await apos.http.get('/api/v1/thing/thing1:en:published');
    assert(thing1);
    person1._tools = [
      {
        ...thing1,
        _fields: {
          skillLevel: 5
        }
      }
    ];
    await apos.http.put('/api/v1/person/person1:en:published', {
      body: person1,
      jar
    });
    const person1After = await apos.http.get('/api/v1/person/person1:en:published', {
      jar
    });
    assert(person1After);
    assert(person1After._tools);
    assert(person1After._tools.length);
    assert(person1After._tools[0].title === 'Red');
    assert(person1After._tools[0]._fields);
    assert(person1After._tools[0]._fields.skillLevel === 5);
  });

  it('cannot POST a product without a session', async function() {
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

  it('can POST products with a session, some visible', async function() {
    // range is exclusive at the top end, I want 10 things
    let widgetId;
    for (let i = 1; (i <= 10); i++) {
      if (i === 1) {
        widgetId = cuid();
      }
      const response = await apos.http.post('/api/v1/product', {
        body: {
          title: 'Cool Product #' + i,
          visibility: (i & 1) ? 'loginRequired' : 'public',
          body: {
            metaType: 'area',
            items: [
              {
                metaType: 'widget',
                type: '@apostrophecms/rich-text',
                _id: (i === 1) ? widgetId : null,
                content: '<p>This is thing ' + i + '</p>'
              },
              // Intentional attempt to use duplicate _id
              {
                metaType: 'widget',
                type: '@apostrophecms/rich-text',
                _id: (i === 1) ? widgetId : null,
                content: '<p>This is thing ' + i + ' second widget</p>'
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
      assert(response.body.items[0].content === `<p>This is thing ${i}</p>`);
      assert(response.body.items[1].content === `<p>This is thing ${i} second widget</p>`);
      if (i === 1) {
        // Deduplicate any duplicate ids we specified at doc level
        assert(response.body.items[0]._id === widgetId);
        assert(response.body.items[1]._id);
        // Quietly deduplicated for us
        assert(response.body.items[1]._id !== widgetId);
        updateProduct = response;
      } else {
        // All new _ids if we did not specify
        assert(response.body.items[0]._id);
        assert(response.body.items[1]._id);
        assert(response.body.items[0]._id !== response.body.items[1]._id);
        assert(response.body.items[0]._id !== widgetId);
      }
    }
  });

  it('can GET five of those products without the user session', async function() {
    const response = await apos.http.get('/api/v1/product');
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
  });

  it('can GET all of those products with a user session', async function() {
    const response = await apos.http.get('/api/v1/product', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 10);
  });

  let firstId;

  it('can GET only 5 if perPage is 5', async function() {
    const response = await apos.http.get('/api/v1/product?perPage=5', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
    firstId = response.results[0]._id;
    assert(response.pages === 2);
  });

  it('can GET a different 5 on page 2', async function() {
    const response = await apos.http.get('/api/v1/product?perPage=5&page=2', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.results.length === 5);
    assert(response.results[0]._id !== firstId);
    assert(response.pages === 2);
  });

  it('can update a product with PUT', async function() {
    const args = {
      body: {
        ...updateProduct,
        title: 'I like cheese',
        _id: 'should-not-change:en:published'
      },
      jar
    };
    const response = await apos.http.put(`/api/v1/product/${updateProduct._id}`, args);
    assert(response);
    assert(response._id === updateProduct._id);
    assert(response.title === 'I like cheese');
    assert(response.body.items.length);
  });

  it('fetch of updated product shows updated content', async function() {
    const response = await apos.http.get(`/api/v1/product/${updateProduct._id}`, {
      jar
    });
    assert(response);
    assert(response._id === updateProduct._id);
    assert(response.title === 'I like cheese');
    assert(response.body.items.length);
  });

  it('can archive a product', async function() {
    return apos.http.patch(`/api/v1/product/${updateProduct._id}`, {
      body: {
        archived: true
      },
      jar
    });
  });

  it('cannot fetch a archived product', async function() {
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

  it('can fetch archived product with archived=any and the right user', async function() {
    const product = await apos.http.get(`/api/v1/product/${updateProduct._id}?archived=any`, {
      jar
    });
    // Should have been a 404, 200 = test fails
    assert(product.archived);
  });

  let relatedProductId;

  it('can insert a product with relationships', async function() {
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
        _articles: [ article ],
        relationshipsInArray: [
          {
            _articles: [ article ]
          }
        ],
        relationshipsInObject: {
          _articles: [ article ]
        }
      },
      jar
    });
    assert(response._id);
    assert(response.articlesIds[0] === article.aposDocId);
    assert(response.articlesFields[article.aposDocId].relevance === 'The very first article that was ever published about this product');
    assert(response.relationshipsInArray[0].articlesIds[0] === article.aposDocId);
    assert(response.relationshipsInObject.articlesIds[0] === article.aposDocId);
    relatedProductId = response._id;
  });

  it('can GET a product with relationships', async function() {
    const response = await apos.http.get('/api/v1/product');
    assert(response);
    assert(response.results);
    const product = _.find(response.results, { slug: 'product-key-product-with-relationship' });
    assert(Array.isArray(product._articles));
    assert(product._articles.length === 1);
    assert(product._articles[0]._fields);
    assert.strictEqual(product._articles[0]._fields.relevance, 'The very first article that was ever published about this product');
    assert(product.relationshipsInArray[0]._articles[0].title === 'First Article');
    assert(product.relationshipsInObject._articles[0].title === 'First Article');
  });

  let relatedArticleId;

  it('can GET a single product with relationships', async function() {
    const response = await apos.http.get(`/api/v1/product/${relatedProductId}`);
    assert(response);
    assert(response._articles);
    assert(response._articles.length === 1);
    relatedArticleId = response._articles[0]._id;
  });

  it('can GET a single product using projections', async function() {
    const response = await apos.http.get(`/api/v1/product/${relatedProductId}`, {
      qs: {
        project: {
          _id: 1,
          title: 1
        }
      }
    });

    const keys = Object.keys(response);

    assert(response);
    assert(keys.length === 2);
    assert(keys.every((key) => [ '_id', 'title' ].includes(key)));
  });

  it('can GET a single article with reverse relationships', async function() {
    const response = await apos.http.get(`/api/v1/article/${relatedArticleId}`);
    assert(response);
    assert(response._products);
    assert(response._products.length === 1);
    assert(response._products[0]._id === relatedProductId);
  });

  it('can GET a single article with reverse relationships in draft mode', async function() {
    const draftRelatedArticleId = relatedArticleId.replace(':published', ':draft');
    const draftRelatedProductId = relatedProductId.replace(':published', ':draft');
    const response = await apos.http.get(`/api/v1/article/${draftRelatedArticleId}`, { jar });
    assert(response);
    assert(response._products);
    assert(response._products.length === 1);
    assert(response._products[0]._id === draftRelatedProductId);
  });

  it('can GET results plus filter choices', async function() {
    const response = await apos.http.get('/api/v1/product?choices=title,visibility,_articles,articles', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.choices.title);
    assert(response.choices.title[0].label.match(/Cool Product/));
    assert(response.choices.visibility);
    assert(response.choices.visibility.length === 2);
    assert(response.choices.visibility.find(item => item.value === 'loginRequired'));
    assert(response.choices.visibility.find(item => item.value === 'public'));
    assert(response.choices._articles);
    assert(response.choices._articles[0].label === 'First Article');
    // an _id
    assert(response.choices._articles[0].value.match(/^c/));
    assert(response.choices.articles[0].label === 'First Article');
    // a slug
    assert(response.choices.articles[0].value === 'first-article');
  });

  it('can GET results plus filter counts', async function() {
    const response = await apos.http.get('/api/v1/product?_edit=1&counts=title,visibility,_articles,articles', {
      jar
    });
    assert(response);
    assert(response.results);
    assert(response.counts);
    assert(response.counts.title);
    assert(response.counts.title[0].label.match(/Cool Product/));
    // Doesn't work for every field type, but does for this
    assert(response.counts.title[0].count === 1);
    assert(response.counts.visibility);
    assert(response.counts.visibility.length === 2);
    assert(response.counts.visibility.find(item => item.value === 'loginRequired'));
    assert(response.counts.visibility.find(item => item.value === 'public'));
    assert(response.counts._articles);
    assert(response.counts._articles[0].label === 'First Article');
    // an _id
    assert(response.counts._articles[0].value.match(/^c/));
    assert(response.counts.articles[0].label === 'First Article');
    // a slug
    assert(response.counts.articles[0].value === 'first-article');
  });

  it('can patch a relationship', async function() {
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
    assert(response.articlesIds[0] === article.aposDocId);
    assert(response._articles);
    assert(response._articles[0]._id === article._id);
  });

  it('can insert a constrained piece that validates', async function() {
    const constrained = await apos.http.post('/api/v1/constrained', {
      body: {
        title: 'First Constrained',
        description: 'longenough'
      },
      jar
    });
    assert(constrained);
    assert(constrained.title === 'First Constrained');
    assert(constrained.description === 'longenough');
  });

  it('cannot insert a constrained piece that does not validate', async function() {
    try {
      await apos.http.post('/api/v1/constrained', {
        body: {
          title: 'Second Constrained',
          description: 'shrt'
        },
        jar
      });
      // Getting here is bad
      assert(false);
    } catch (e) {
      assert(e);
      assert(e.status === 400);
      assert(e.body.data.errors);
      assert(e.body.data.errors.length === 1);
      assert(e.body.data.errors[0].path === 'description');
      assert(e.body.data.errors[0].name === 'min');
      assert(e.body.data.errors[0].code === 400);
    }
  });

  let advisoryLockTestId;

  it('can insert a product for advisory lock testing', async function() {
    const response = await apos.http.post('/api/v1/product', {
      body: {
        title: 'Advisory Test',
        name: 'advisory-test'
      },
      jar
    });
    const article = response;
    assert(article);
    assert(article.title === 'Advisory Test');
    advisoryLockTestId = article._id;
  });

  it('can get an advisory lock on a product while patching a property', async function() {
    const product = await apos.http.patch(`/api/v1/product/${advisoryLockTestId}`, {
      jar,
      body: {
        _advisoryLock: {
          tabId: 'xyz',
          lock: true
        },
        title: 'Advisory Test Patched'
      }
    });
    assert(product.title === 'Advisory Test Patched');
  });

  it('cannot get an advisory lock with a different context id', async function() {
    try {
      await apos.http.patch(`/api/v1/product/${advisoryLockTestId}`, {
        jar,
        body: {
          _advisoryLock: {
            tabId: 'pdq',
            lock: true
          }
        }
      });
      assert(false);
    } catch (e) {
      assert(e.status === 409);
      assert(e.body.name === 'locked');
      assert(e.body.data.me);
    }
  });

  it('can get an advisory lock with a different context id if forcing', async function() {
    await apos.http.patch(`/api/v1/product/${advisoryLockTestId}`, {
      jar,
      body: {
        _advisoryLock: {
          tabId: 'pdq',
          lock: true,
          force: true
        }
      }
    });
  });

  it('can renew the advisory lock with the second context id after forcing', async function() {
    await apos.http.patch(`/api/v1/product/${advisoryLockTestId}`, {
      jar,
      body: {
        _advisoryLock: {
          tabId: 'pdq',
          lock: true
        }
      }
    });
  });

  it('can unlock the advisory lock while patching a property', async function() {
    const product = await apos.http.patch(`/api/v1/product/${advisoryLockTestId}`, {
      jar,
      body: {
        _advisoryLock: {
          tabId: 'pdq',
          lock: false
        },
        title: 'Advisory Test Patched Again'
      }
    });
    assert(product.title === 'Advisory Test Patched Again');
  });

  it('can relock with the first context id after unlocking', async function() {
    const doc = await apos.http.patch(`/api/v1/product/${advisoryLockTestId}`, {
      jar,
      body: {
        _advisoryLock: {
          tabId: 'xyz',
          lock: true
        }
      }
    });
    assert(doc.title === 'Advisory Test Patched Again');
  });

  let jar2;

  it('should be able to log in as second user', async function() {
    jar2 = apos.http.jar();

    // establish session
    let page = await apos.http.get('/', {
      jar: jar2
    });

    assert(page.match(/logged out/));

    // Log in

    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin2',
        password: 'admin2',
        session: true
      },
      jar: jar2
    });

    // Confirm login
    page = await apos.http.get('/', {
      jar: jar2
    });

    assert(page.match(/logged in/));
  });

  it('second user with a distinct tabId gets an appropriate error specifying who has the lock', async function() {
    try {
      await apos.http.patch(`/api/v1/product/${advisoryLockTestId}`, {
        jar: jar2,
        body: {
          _advisoryLock: {
            tabId: 'nbc',
            lock: true
          }
        }
      });
      assert(false);
    } catch (e) {
      assert(e.status === 409);
      assert(e.body.name === 'locked');
      assert(!e.body.data.me);
      assert(e.body.data.username === 'admin');
    }
  });

  it('can log out to destroy a session', async function() {
    await apos.http.post('/api/v1/@apostrophecms/login/logout', {
      followAllRedirects: true,
      jar
    });
    await apos.http.post('/api/v1/@apostrophecms/login/logout', {
      followAllRedirects: true,
      jar: jar2
    });
  });

  it('cannot POST a product with a logged-out cookie jar', async function() {
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

  let token;
  let bearerProductId;

  it('should be able to log in as admin and get a bearer token', async function() {
    // Log in
    const response = await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin'
      }
    });
    assert(response.token);
    token = response.token;
  });

  it('can POST a product with the bearer token', async function() {
    const response = await apos.http.post('/api/v1/product', {
      body: {
        title: 'Bearer Token Product',
        visibility: 'loginRequired',
        slug: 'bearer-token-product',
        body: {
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              id: cuid(),
              content: '<p>This is a bearer token thing</p>'
            }
          ]
        }
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    assert(response);
    assert(response._id);
    assert(response.body);
    assert(response.title === 'Bearer Token Product');
    assert(response.slug === 'bearer-token-product');
    assert(response.type === 'product');
    bearerProductId = response._id;
  });

  it('can GET a loginRequired product with the bearer token', async function() {
    const response = await apos.http.get(`/api/v1/product/${bearerProductId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    assert(response);
    assert(response.title === 'Bearer Token Product');
  });

  it('can log out to destroy a bearer token', async function() {
    return apos.http.post('/api/v1/@apostrophecms/login/logout', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  });

  it('cannot GET a loginRequired product with a destroyed bearer token', async function() {
    try {
      await apos.http.get(`/api/v1/product/${bearerProductId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      assert(false);
    } catch (e) {
      assert(e.status === 401);
    }
  });

  let apiKeyProductId;

  it('can POST a product with the api key', async function() {
    const response = await apos.http.post('/api/v1/product', {
      body: {
        title: 'API Key Product',
        visibility: 'loginRequired',
        slug: 'api-key-product',
        body: {
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              id: cuid(),
              content: '<p>This is an api key thing</p>'
            }
          ]
        }
      },
      headers: {
        Authorization: `ApiKey ${apiKey}`
      }
    });
    assert(response);
    assert(response._id);
    assert(response.body);
    assert(response.title === 'API Key Product');
    assert(response.slug === 'api-key-product');
    assert(response.type === 'product');
    apiKeyProductId = response._id;
  });

  it('can GET a loginRequired product with the api key', async function() {
    const response = await apos.http.get(`/api/v1/product/${apiKeyProductId}`, {
      headers: {
        Authorization: `ApiKey ${apiKey}`
      }
    });
    assert(response);
    assert(response.title === 'API Key Product');
  });

  it('can insert a resume with an attachment', async function() {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(path.join(__dirname, '/public/static-test.txt')));

    // Make an async request to upload the image.
    const attachment = await apos.http.post('/api/v1/@apostrophecms/attachment/upload', {
      headers: {
        Authorization: `ApiKey ${apiKey}`
      },
      body: formData
    });

    const resume = await apos.http.post('/api/v1/resume', {
      headers: {
        Authorization: `ApiKey ${apiKey}`
      },
      body: {
        title: 'Jane Doe',
        attachment
      }
    });
    assert(resume);
    assert(resume.title === 'Jane Doe');
    assert(resume.attachment._url);
    assert(fs.readFileSync(path.join(__dirname, 'public', resume.attachment._url), 'utf8') === fs.readFileSync(path.join(__dirname, '/public/static-test.txt'), 'utf8'));
  });

  it('should convert a piece keeping only the present fields', async function() {
    const req = apos.task.getReq();

    const inputPiece = {
      title: 'new product name'
    };

    const existingPiece = {
      color: 'red'
    };

    await apos.modules.product.convert(req, inputPiece, existingPiece, { presentFieldsOnly: true });

    assert(Object.keys(existingPiece).length === 2);
    assert(existingPiece.title === 'new product name');
    assert(existingPiece.color === 'red');
  });

  it('should not set a cache-control value when retrieving pieces, when cache option is not set', async function() {
    const response1 = await apos.http.get('/api/v1/thing', { fullResponse: true });
    const response2 = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    assert(response1.headers['cache-control'] === undefined);
    assert(response2.headers['cache-control'] === undefined);
  });

  it('should not set a cache-control value when retrieving a single piece, when "etags" cache option is set', async function() {
    apos.thing.options.cache = {
      api: {
        maxAge: 5555,
        etags: true
      }
    };

    const response = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    assert(response.headers['cache-control'] === undefined);
  });

  it('should not set a cache-control value when retrieving pieces, when "api" cache option is not set', async function() {
    apos.thing.options.cache = {
      page: {
        maxAge: 5555
      }
    };

    const response1 = await apos.http.get('/api/v1/thing', { fullResponse: true });
    const response2 = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    assert(response1.headers['cache-control'] === undefined);
    assert(response2.headers['cache-control'] === undefined);

    delete apos.thing.options.cache;
  });

  it('should set a "max-age" cache-control value when retrieving pieces, when "api" cache option is set', async function() {
    apos.thing.options.cache = {
      api: {
        maxAge: 3333
      }
    };

    const response1 = await apos.http.get('/api/v1/thing', { fullResponse: true });
    const response2 = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    assert(response1.headers['cache-control'] === 'max-age=3333');
    assert(response2.headers['cache-control'] === 'max-age=3333');

    delete apos.thing.options.cache;
  });

  it('should set a "no-store" cache-control value when retrieving pieces, when user is connected', async function() {
    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin',
        session: true
      },
      jar
    });

    const response1 = await apos.http.get('/api/v1/thing', {
      fullResponse: true,
      jar
    });
    const response2 = await apos.http.get('/api/v1/thing/testThing:en:published', {
      fullResponse: true,
      jar
    });

    assert(response1.headers['cache-control'] === 'no-store');
    assert(response2.headers['cache-control'] === 'no-store');
  });

  it('should set a "no-store" cache-control value when retrieving pieces, when "api" cache option is set, when user is connected', async function() {
    apos.thing.options.cache = {
      api: {
        maxAge: 3333
      }
    };

    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin',
        session: true
      },
      jar
    });

    const response1 = await apos.http.get('/api/v1/thing', {
      fullResponse: true,
      jar
    });
    const response2 = await apos.http.get('/api/v1/thing/testThing:en:published', {
      fullResponse: true,
      jar
    });

    assert(response1.headers['cache-control'] === 'no-store');
    assert(response2.headers['cache-control'] === 'no-store');

    delete apos.thing.options.cache;
  });

  it('should set a "no-store" cache-control value when retrieving pieces, when user is connected using an api key', async function() {
    const response1 = await apos.http.get(`/api/v1/thing?apiKey=${apiKey}`, { fullResponse: true });
    const response2 = await apos.http.get(`/api/v1/thing/testThing:en:published?apiKey=${apiKey}`, { fullResponse: true });

    assert(response1.headers['cache-control'] === 'no-store');
    assert(response2.headers['cache-control'] === 'no-store');
  });

  it('should set a "no-store" cache-control value when retrieving pieces, when "api" cache option is set, when user is connected using an api key', async function() {
    apos.thing.options.cache = {
      api: {
        maxAge: 3333
      }
    };

    const response1 = await apos.http.get(`/api/v1/thing?apiKey=${apiKey}`, { fullResponse: true });
    const response2 = await apos.http.get(`/api/v1/thing/testThing:en:published?apiKey=${apiKey}`, { fullResponse: true });

    assert(response1.headers['cache-control'] === 'no-store');
    assert(response2.headers['cache-control'] === 'no-store');

    delete apos.thing.options.cache;
  });

  it('should set a custom etag when retrieving a single piece', async function() {
    apos.thing.options.cache = {
      api: {
        maxAge: 1111,
        etags: true
      }
    };

    const response = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    const eTagParts = response.headers.etag.split(':');

    assert(eTagParts[0] === apos.asset.getReleaseId());
    assert(eTagParts[1] === (new Date(response.body.cacheInvalidatedAt)).getTime().toString());
    assert(eTagParts[2]);

    delete apos.thing.options.cache;
  });

  it('should return a 304 status code when retrieving a piece with a matching etag', async function() {
    apos.thing.options.cache = {
      api: {
        maxAge: 1111,
        etags: true
      }
    };

    const response1 = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });
    const response2 = await apos.http.get('/api/v1/thing/testThing:en:published', {
      fullResponse: true,
      headers: {
        'if-none-match': response1.headers.etag
      }
    });

    assert(response1.status === 200);
    assert(response1.body);

    assert(response2.status === 304);
    assert(response2.body === '');

    // Same ETag should be sent again to the client
    assert(response1.headers.etag === response2.headers.etag);

    delete apos.thing.options.cache;
  });

  it('should not return a 304 status code when retrieving a piece that has been edited', async function() {
    apos.thing.options.cache = {
      api: {
        maxAge: 1111,
        etags: true
      }
    };

    const response1 = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    const pieceDoc = await apos.doc.db.findOne({
      aposDocId: 'testThing',
      aposLocale: 'en:published'
    });

    // Edit piece, this should invalidate its cache,
    // so requesting it again should not return a 304 status code
    const pieceUpdateResponse = await apos.doc.update(apos.task.getReq(), pieceDoc);

    const response2 = await apos.http.get('/api/v1/thing/testThing:en:published', {
      fullResponse: true,
      headers: {
        'if-none-match': response1.headers.etag
      }
    });

    const eTag1Parts = response1.headers.etag.split(':');
    const eTag2Parts = response2.headers.etag.split(':');

    assert(response1.status === 200);
    assert(response1.body);

    assert(response2.status === 200);
    assert(response2.body);

    // New ETag has been generated, with the new value of the edited piece's `cacheInvalidatedAt` field...
    assert(eTag2Parts[1] === pieceUpdateResponse.cacheInvalidatedAt.getTime().toString());
    // ...and a new timestamp
    assert(eTag2Parts[2] !== eTag1Parts[2]);

    delete apos.thing.options.cache;
  });

  it('should not return a 304 status code when retrieving a piece after the max-age period', async function() {
    apos.thing.options.cache = {
      api: {
        maxAge: 4444,
        etags: true
      }
    };

    const response1 = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    const eTagParts = response1.headers.etag.split(':');
    const outOfDateETagParts = [ ...eTagParts ];
    outOfDateETagParts[2] = Number(outOfDateETagParts[2]) - (4444 + 1) * 1000; // 1s outdated

    const response2 = await apos.http.get('/api/v1/thing/testThing:en:published', {
      fullResponse: true,
      headers: {
        'if-none-match': outOfDateETagParts.join(':')
      }
    });

    const eTag1Parts = response1.headers.etag.split(':');
    const eTag2Parts = response2.headers.etag.split(':');

    assert(response1.status === 200);
    assert(response1.body);

    assert(response2.status === 200);
    assert(response2.body);

    // New timestamp
    assert(eTag1Parts[2] !== eTag2Parts[2]);

    delete apos.thing.options.cache;
  });

  it('should not set a custom etag when retrieving a single piece, when user is connected', async function() {
    apos.thing.options.cache = {
      api: {
        maxAge: 3333,
        etags: true
      }
    };

    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin',
        session: true
      },
      jar
    });

    const response = await apos.http.get('/api/v1/thing/testThing:en:published', {
      fullResponse: true,
      jar
    });

    const eTagParts = response.headers.etag.split(':');

    assert(eTagParts[0] !== apos.asset.getReleaseId());
    assert(eTagParts[1] !== (new Date(response.body.cacheInvalidatedAt)).getTime().toString());

    delete apos.thing.options.cache;
  });

  it('should not set a custom etag when retrieving a single piece, when user is connected using an api key', async function() {
    apos.thing.options.cache = {
      api: {
        maxAge: 3333,
        etags: true
      }
    };

    const response = await apos.http.get(`/api/v1/thing/testThing:en:published?apiKey=${apiKey}`, { fullResponse: true });

    const eTagParts = response.headers.etag.split(':');

    assert(eTagParts[0] !== apos.asset.getReleaseId());
    assert(eTagParts[1] !== (new Date(response.body.cacheInvalidatedAt)).getTime().toString());

    delete apos.thing.options.cache;
  });

  describe('unpublish', function() {
    const baseItem = {
      aposDocId: 'some-product',
      type: 'product',
      slug: '/some-product',
      visibility: 'public'
    };
    const draftItem = {
      ...baseItem,
      _id: 'some-product:en:draft',
      aposLocale: 'en:draft'
    };
    const publishedItem = {
      ...baseItem,
      _id: 'some-product:en:published',
      aposLocale: 'en:published'
    };
    const previousItem = {
      ...baseItem,
      _id: 'some-product:en:previous',
      aposLocale: 'en:previous'
    };

    let draft;
    let published;
    let previous;

    this.beforeEach(async function() {
      await apos.doc.db.insertMany([
        draftItem,
        publishedItem,
        previousItem
      ]);

      draft = await apos.http.post(
        `/api/v1/product/${publishedItem._id}/unpublish?apiKey=${apiKey}`,
        {
          body: {},
          busy: true
        }
      );

      published = await apos.doc.db.findOne({ _id: 'some-product:en:published' });
      previous = await apos.doc.db.findOne({ _id: 'some-product:en:previous' });
    });

    this.afterEach(async function() {
      await apos.doc.db.deleteMany({
        aposDocId: 'some-product'
      });
    });

    it('should remove the published and previous versions of a piece', function() {
      assert(published === null);
      assert(previous === null);
    });

    it('should update the draft version of a piece', function() {
      assert(draft._id === draftItem._id);
      assert(draft.modified === true);
      assert(draft.lastPublishedAt === null);
    });
  });

  describe('share/unshare', function() {
    const product = {
      aposDocId: 'some-product',
      type: 'product',
      slug: '/some-product',
      visibility: 'public'
    };

    it('should have a "share" method that returns a draft with aposShareKey', async function() {
      assert(apos.modules.thing.share);

      const previousPublished = await apos.modules.thing.insert(apos.task.getReq(), product);
      const previousDraft = await apos.modules.thing.findOneForEditing(apos.task.getReq({ mode: 'draft' }), { _id: 'some-product:en:draft' });

      const response = await apos.modules.thing.share(apos.task.getReq(), previousDraft);
      const draft = await apos.doc.db.findOne({
        _id: `${previousDraft.aposDocId}:en:draft`
      });
      const published = await apos.doc.db.findOne({
        _id: `${previousDraft.aposDocId}:en:published`
      });

      assert(!Object.prototype.hasOwnProperty.call(previousPublished, 'aposShareKey'));
      assert(!Object.prototype.hasOwnProperty.call(previousDraft, 'aposShareKey'));
      assert(!Object.prototype.hasOwnProperty.call(published, 'aposShareKey'));
      assert(response.aposShareKey);
      assert(draft.aposShareKey);
      assert(response.aposShareKey === draft.aposShareKey);

      await apos.modules.thing.delete(apos.task.getReq(), published);
      await apos.modules.thing.delete(apos.task.getReq(), draft);
    });

    it('should have a "unshare" method that returns a draft without aposShareKey', async function() {
      assert(apos.modules.thing.share);

      const previousPublished = await apos.modules.thing.insert(apos.task.getReq(), product);
      const previousDraft = await apos.modules.thing.findOneForEditing(apos.task.getReq({ mode: 'draft' }), { _id: 'some-product:en:draft' });

      await apos.modules.thing.share(apos.task.getReq(), previousDraft);
      const response = await apos.modules.thing.unshare(apos.task.getReq(), previousDraft);
      const draft = await apos.doc.db.findOne({
        _id: `${previousDraft.aposDocId}:en:draft`
      });
      const published = await apos.doc.db.findOne({
        _id: `${previousDraft.aposDocId}:en:published`
      });

      assert(!Object.prototype.hasOwnProperty.call(previousPublished, 'aposShareKey'));
      assert(!Object.prototype.hasOwnProperty.call(previousDraft, 'aposShareKey'));
      assert(!Object.prototype.hasOwnProperty.call(published, 'aposShareKey'));
      assert(!Object.prototype.hasOwnProperty.call(response, 'aposShareKey'));
      assert(!Object.prototype.hasOwnProperty.call(draft, 'aposShareKey'));

      await apos.modules.thing.delete(apos.task.getReq(), published);
    });
  });
});
