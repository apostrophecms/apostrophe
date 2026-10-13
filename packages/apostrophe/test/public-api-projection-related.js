const t = require('../test-lib/test.js');
const assert = require('assert');

// GHSA-rqgm-cfrp-4hx8: for anonymous REST API requests restricted by
// `publicApiProjection`, documents loaded through relationships must be
// limited to the `publicApiProjection` of their own type, and left out if
// their type has no public API at all. Otherwise every field of a related
// document is returned, including fields its own projection hides.
// Server-side rendering and unrestricted (API key) requests are unchanged.

describe('Public API projection: related documents (GHSA-rqgm-cfrp-4hx8)', function() {

  let apos;
  let country;
  let author;
  let category;
  let article;
  let page;
  const apiKey = 'public api projection related test key';

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  it('should initialize', async function() {
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
        '@apostrophecms/page': {
          options: {
            park: [],
            types: [
              {
                name: '@apostrophecms/home-page',
                label: 'Home'
              },
              {
                name: 'rqgm-related-page',
                label: 'Related Page'
              }
            ],
            publicApiProjection: {
              title: 1,
              slug: 1,
              path: 1,
              level: 1,
              rank: 1,
              _url: 1,
              _author: 1,
              _category: 1,
              // Pages are found as @apostrophecms/any-page-type, so the
              // relationship storage must be projected explicitly
              authorIds: 1,
              authorFields: 1,
              categoryIds: 1,
              categoryFields: 1,
              main: 1
            }
          }
        },
        'rqgm-featured-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              _author: {
                type: 'relationship',
                withType: 'rqgm-author'
              },
              _category: {
                type: 'relationship',
                withType: 'rqgm-category'
              }
            }
          }
        },
        'rqgm-related-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              secretNote: {
                type: 'string',
                label: 'Secret Note'
              },
              _author: {
                type: 'relationship',
                withType: 'rqgm-author'
              },
              _category: {
                type: 'relationship',
                withType: 'rqgm-category'
              },
              main: {
                type: 'area',
                options: {
                  widgets: {
                    'rqgm-featured': {}
                  }
                }
              }
            }
          }
        },
        // Has a narrower projection of its own
        'rqgm-country': {
          extend: '@apostrophecms/piece-type',
          options: {
            publicApiProjection: {
              title: 1
            }
          },
          fields: {
            add: {
              secretCode: {
                type: 'string',
                label: 'Secret Code'
              }
            }
          }
        },
        'rqgm-author': {
          extend: '@apostrophecms/piece-type',
          options: {
            publicApiProjection: {
              title: 1,
              slug: 1,
              _country: 1,
              _articles: 1
            }
          },
          fields: {
            add: {
              bio: {
                type: 'string',
                label: 'Bio'
              },
              _country: {
                type: 'relationship',
                withType: 'rqgm-country'
              },
              _articles: {
                type: 'relationshipReverse',
                withType: 'rqgm-article',
                reverseOf: '_author'
              }
            }
          }
        },
        // No public REST API at all
        'rqgm-category': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              internalNote: {
                type: 'string',
                label: 'Internal Note'
              }
            }
          }
        },
        'rqgm-article': {
          extend: '@apostrophecms/piece-type',
          options: {
            publicApiProjection: {
              title: 1,
              slug: 1,
              _author: 1,
              _authorBrief: 1,
              _category: 1,
              _pages: 1,
              main: 1,
              links: 1
            }
          },
          fields: {
            add: {
              secretNote: {
                type: 'string',
                label: 'Secret Note'
              },
              _author: {
                type: 'relationship',
                withType: 'rqgm-author',
                withRelationships: [ '_country' ]
              },
              // The relationship's own projection still applies too
              _authorBrief: {
                type: 'relationship',
                withType: 'rqgm-author',
                builders: {
                  project: {
                    title: 1,
                    bio: 1
                  }
                }
              },
              _category: {
                type: 'relationship',
                withType: 'rqgm-category'
              },
              // Related pages are limited to the projection of
              // @apostrophecms/page
              _pages: {
                type: 'relationship',
                withType: '@apostrophecms/any-page-type'
              },
              main: {
                type: 'area',
                options: {
                  widgets: {
                    'rqgm-featured': {}
                  }
                }
              },
              links: {
                type: 'array',
                fields: {
                  add: {
                    _author: {
                      type: 'relationship',
                      withType: 'rqgm-author'
                    },
                    _category: {
                      type: 'relationship',
                      withType: 'rqgm-category'
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  const widget = () => ({
    metaType: 'area',
    items: [
      {
        _id: apos.util.generateId(),
        metaType: 'widget',
        type: 'rqgm-featured',
        _author: [ author ],
        _category: [ category ]
      }
    ]
  });

  it('should insert test content', async function() {
    const req = apos.task.getReq();
    country = await apos.modules['rqgm-country'].insert(req, {
      ...apos.modules['rqgm-country'].newInstance(),
      title: 'Country X',
      secretCode: 'zzcountrysecret'
    });
    author = await apos.modules['rqgm-author'].insert(req, {
      ...apos.modules['rqgm-author'].newInstance(),
      title: 'Author A',
      bio: 'zzauthorbio',
      _country: [ country ]
    });
    category = await apos.modules['rqgm-category'].insert(req, {
      ...apos.modules['rqgm-category'].newInstance(),
      title: 'Category C',
      internalNote: 'zzcategorynote'
    });
    article = await apos.modules['rqgm-article'].insert(req, {
      ...apos.modules['rqgm-article'].newInstance(),
      title: 'Article R',
      secretNote: 'zzarticlesecret',
      _author: [ author ],
      _authorBrief: [ author ],
      _category: [ category ],
      main: widget(),
      links: [
        {
          _id: apos.util.generateId(),
          metaType: 'arrayItem',
          scopedArrayName: 'rqgm-article.links',
          _author: [ author ],
          _category: [ category ]
        }
      ]
    });
    const home = await apos.page.find(req, { level: 0 }).toObject();
    page = await apos.page.insert(req, home._id, 'lastChild', {
      type: 'rqgm-related-page',
      title: 'Related Page',
      secretNote: 'zzpagesecret',
      visibility: 'public',
      _author: [ author ],
      _category: [ category ],
      main: widget()
    });
  });

  const secrets = [
    'zzauthorbio',
    'zzcountrysecret',
    'zzcategorynote',
    'zzarticlesecret',
    'zzpagesecret'
  ];

  function assertNoSecrets(value) {
    const json = JSON.stringify(value);
    for (const secret of secrets) {
      assert(!json.includes(secret), `${secret} should not be present`);
    }
  }

  function assertArticleRestricted(doc) {
    assert.strictEqual(doc.title, 'Article R');
    assert.strictEqual(doc.secretNote, undefined);
    // (a) related type with a narrower projection of its own
    assert.strictEqual(doc._author.length, 1);
    assert.strictEqual(doc._author[0].title, 'Author A');
    assert.strictEqual(doc._author[0].bio, undefined);
    // nested relationship, limited to the projection of its own type
    assert.strictEqual(doc._author[0]._country.length, 1);
    assert.strictEqual(doc._author[0]._country[0].title, 'Country X');
    assert.strictEqual(doc._author[0]._country[0].secretCode, undefined);
    // the relationship's own projection and the related type's projection
    // both apply
    assert.strictEqual(doc._authorBrief.length, 1);
    assert.strictEqual(doc._authorBrief[0].title, 'Author A');
    assert.strictEqual(doc._authorBrief[0].bio, undefined);
    // (b) related type without a public API
    assert.deepStrictEqual(doc._category || [], []);
    // relationships in widgets
    const [ item ] = doc.main.items;
    assert.strictEqual(item._author[0].title, 'Author A');
    assert.strictEqual(item._author[0].bio, undefined);
    assert.deepStrictEqual(item._category || [], []);
    // relationships in array items
    assert.strictEqual(doc.links[0]._author[0].title, 'Author A');
    assert.strictEqual(doc.links[0]._author[0].bio, undefined);
    assert.deepStrictEqual(doc.links[0]._category || [], []);
    assertNoSecrets(doc);
  }

  it('anonymous: related pieces in a single piece are limited to their own projection', async function() {
    const doc = await apos.http.get(`/api/v1/rqgm-article/${article._id}`);
    assertArticleRestricted(doc);
  });

  it('anonymous: related pieces in a list of pieces are limited to their own projection', async function() {
    const response = await apos.http.get('/api/v1/rqgm-article');
    assert.strictEqual(response.results.length, 1);
    assertArticleRestricted(response.results[0]);
  });

  it('anonymous: related pages are limited to the projection of @apostrophecms/page', async function() {
    const req = apos.task.getReq();
    await apos.modules['rqgm-article'].update(req, {
      ...await apos.modules['rqgm-article'].find(req, { _id: article._id }).toObject(),
      _pages: [ page ]
    });
    try {
      const doc = await apos.http.get(`/api/v1/rqgm-article/${article._id}`);
      assert.strictEqual(doc._pages.length, 1);
      assert.strictEqual(doc._pages[0].title, 'Related Page');
      assert.strictEqual(doc._pages[0].secretNote, undefined);
      assertNoSecrets(doc);
      const full = await apos.http.get(`/api/v1/rqgm-article/${article._id}?apikey=${apiKey}`);
      assert.strictEqual(full._pages[0].secretNote, 'zzpagesecret');
    } finally {
      await apos.modules['rqgm-article'].update(req, {
        ...await apos.modules['rqgm-article'].find(req, { _id: article._id }).toObject(),
        _pages: []
      });
    }
  });

  it('anonymous: reverse relationships are limited to the projection of the related type', async function() {
    const doc = await apos.http.get(`/api/v1/rqgm-author/${author._id}`);
    assert.strictEqual(doc.bio, undefined);
    assert.strictEqual(doc._articles.length, 1);
    assert.strictEqual(doc._articles[0].title, 'Article R');
    assert.strictEqual(doc._articles[0].secretNote, undefined);
    assertNoSecrets(doc);
  });

  it('anonymous: related pieces of a page are limited to their own projection', async function() {
    const doc = await apos.http.get(`/api/v1/@apostrophecms/page/${page._id}`);
    assert.strictEqual(doc.title, 'Related Page');
    assert.strictEqual(doc.secretNote, undefined);
    assert.strictEqual(doc._author[0].title, 'Author A');
    assert.strictEqual(doc._author[0].bio, undefined);
    assert.deepStrictEqual(doc._category || [], []);
    assert.strictEqual(doc.main.items[0]._author[0].bio, undefined);
    assert.deepStrictEqual(doc.main.items[0]._category || [], []);
    assertNoSecrets(doc);

    const list = await apos.http.get('/api/v1/@apostrophecms/page?type=rqgm-related-page');
    assert.strictEqual(list.results.length, 1);
    assert.strictEqual(list.results[0]._author[0].title, 'Author A');
    assertNoSecrets(list);
  });

  it('anonymous: rendered areas still show the related fields their templates use', async function() {
    const doc = await apos.http.get(`/api/v1/rqgm-article/${article._id}?render-areas=1`);
    assert(doc.main._rendered.includes('zzauthorbio'));
    assert(doc.main._rendered.includes('zzcategorynote'));
    assert.strictEqual(doc._author[0].bio, undefined);
    assert.deepStrictEqual(doc._category || [], []);
  });

  it('anonymous: server-side page rendering still has every field of related documents', async function() {
    const { _url } = await apos.page.find(apos.task.getReq(), { _id: page._id })
      .toObject();
    const html = await apos.http.get(_url);
    assert(html.includes('<p class="author-bio">zzauthorbio</p>'));
    assert(html.includes('<p class="category-note">zzcategorynote</p>'));
    assert(html.includes('<p class="featured-bio">zzauthorbio</p>'));
    assert(html.includes('<p class="featured-note">zzcategorynote</p>'));
  });

  it('API key (not restricted by the projection): related documents are complete', async function() {
    const doc = await apos.http.get(`/api/v1/rqgm-article/${article._id}?apikey=${apiKey}`);
    assert.strictEqual(doc.secretNote, 'zzarticlesecret');
    assert.strictEqual(doc._author[0].bio, 'zzauthorbio');
    assert.strictEqual(doc._author[0]._country[0].secretCode, 'zzcountrysecret');
    assert.strictEqual(doc._authorBrief[0].bio, 'zzauthorbio');
    assert.strictEqual(doc._category[0].internalNote, 'zzcategorynote');
    assert.strictEqual(doc.main.items[0]._author[0].bio, 'zzauthorbio');
    assert.strictEqual(doc.main.items[0]._category[0].internalNote, 'zzcategorynote');
    assert.strictEqual(doc.links[0]._category[0].internalNote, 'zzcategorynote');

    const reverse = await apos.http.get(`/api/v1/rqgm-author/${author._id}?apikey=${apiKey}`);
    assert.strictEqual(reverse._articles[0].secretNote, 'zzarticlesecret');

    const pageDoc = await apos.http.get(`/api/v1/@apostrophecms/page/${page._id}?apikey=${apiKey}`);
    assert.strictEqual(pageDoc.secretNote, 'zzpagesecret');
    assert.strictEqual(pageDoc._author[0].bio, 'zzauthorbio');
    assert.strictEqual(pageDoc._category[0].internalNote, 'zzcategorynote');
  });
});
