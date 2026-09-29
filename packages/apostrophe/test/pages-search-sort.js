const t = require('../test-lib/test.js');
const assert = require('assert/strict');

// Titles are chosen so that alphabetical (default) order is the
// opposite of text search quality order: "Zebra" matches "zebra"
// in the heavily weighted title, "Aardvark" only in a lower
// weighted string field.

describe('Pages search sort', function() {
  let apos;
  let jar;

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/page': {
          options: {
            park: [],
            types: [
              {
                name: '@apostrophecms/home-page',
                label: 'Home'
              },
              {
                name: 'test-page',
                label: 'Test Page'
              }
            ]
          }
        },
        'test-page': {
          extend: '@apostrophecms/page-type',
          options: {
            alias: 'testPage'
          },
          fields: {
            add: {
              subtitle: {
                type: 'string',
                label: 'Subtitle'
              }
            }
          }
        },
        'test-piece': {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'testPiece'
          },
          fields: {
            add: {
              subtitle: {
                type: 'string',
                label: 'Subtitle'
              }
            }
          }
        }
      }
    });

    await t.createAdmin(apos, {
      username: 'admin',
      password: 'admin',
      title: 'admin',
      email: 'admin@example.com'
    });
    jar = await t.loginAs(apos, 'admin');

    const req = apos.task.getReq();
    const home = await apos.page.find(req, { slug: '/' }).toObject();
    // Insert "Zebra" first so that "Aardvark" is the most recently
    // updated, as well as first alphabetically
    for (const [ title, subtitle ] of [
      [ 'Zebra', 'plain' ],
      [ 'Aardvark', 'zebra' ]
    ]) {
      await apos.page.insert(req, home._id, 'lastChild', {
        title,
        subtitle,
        type: 'test-page'
      });
      await apos.testPiece.insert(req, {
        title,
        subtitle
      });
    }
  });

  after(async function() {
    return t.destroy(apos);
  });

  function titles(docs) {
    return docs.map(doc => doc.title);
  }

  it('pieces control: search sorts by text score', async function() {
    const req = apos.task.getReq();
    const docs = await apos.testPiece.find(req).search('zebra').toArray();
    assert.deepEqual(titles(docs), [ 'Zebra', 'Aardvark' ]);
  });

  it('pieces control: autocomplete sorts by text score', async function() {
    const req = apos.task.getReq();
    const docs = await apos.testPiece.find(req).autocomplete('zeb').toArray();
    assert.deepEqual(titles(docs), [ 'Zebra', 'Aardvark' ]);
  });

  it('apos.page.find with search sorts by text score', async function() {
    const req = apos.task.getReq();
    const docs = await apos.page.find(req).search('zebra').toArray();
    assert.deepEqual(titles(docs), [ 'Zebra', 'Aardvark' ]);
  });

  it('apos.page.find with autocomplete sorts by text score', async function() {
    const req = apos.task.getReq();
    const docs = await apos.page.find(req).autocomplete('zeb').toArray();
    assert.deepEqual(titles(docs), [ 'Zebra', 'Aardvark' ]);
  });

  it('page type find with search sorts by text score', async function() {
    const req = apos.task.getReq();
    const docs = await apos.testPage.find(req).search('zebra').toArray();
    assert.deepEqual(titles(docs), [ 'Zebra', 'Aardvark' ]);
  });

  it('page type find with autocomplete sorts by text score', async function() {
    const req = apos.task.getReq();
    const docs = await apos.testPage.find(req).autocomplete('zeb').toArray();
    assert.deepEqual(titles(docs), [ 'Zebra', 'Aardvark' ]);
  });

  it('explicit sort still wins over search', async function() {
    const req = apos.task.getReq();
    const docs = await apos.page.find(req)
      .search('zebra')
      .sort({ title: 1 })
      .toArray();
    assert.deepEqual(titles(docs), [ 'Aardvark', 'Zebra' ]);
  });

  it('page REST API with autocomplete sorts by text score', async function() {
    const response = await apos.http.get('/api/v1/@apostrophecms/page', {
      jar,
      qs: {
        autocomplete: 'zeb'
      }
    });
    assert.deepEqual(titles(response.results), [ 'Zebra', 'Aardvark' ]);
  });

  it('page REST API with type and search sorts by text score', async function() {
    const response = await apos.http.get('/api/v1/@apostrophecms/page', {
      jar,
      qs: {
        type: 'test-page',
        search: 'zebra'
      }
    });
    assert.deepEqual(titles(response.results), [ 'Zebra', 'Aardvark' ]);
  });

  it('page REST API with type and autocomplete sorts by text score', async function() {
    const response = await apos.http.get('/api/v1/@apostrophecms/page', {
      jar,
      qs: {
        type: 'test-page',
        autocomplete: 'zeb'
      }
    });
    assert.deepEqual(titles(response.results), [ 'Zebra', 'Aardvark' ]);
  });

  // What the relationship input sends: `relationshipSuggestionLimit`
  // always, but `relationshipSuggestionSort` only when not autocompleting,
  // so the back end can sort by search quality

  it('page REST API with autocomplete and suggestion limit sorts by text score', async function() {
    const response = await apos.http.get('/api/v1/@apostrophecms/page', {
      jar,
      qs: {
        autocomplete: 'zeb',
        perPage: 25,
        aposMode: 'draft'
      }
    });
    assert.deepEqual(titles(response.results), [ 'Zebra', 'Aardvark' ]);
  });

  it('page REST API with type, autocomplete and suggestion limit sorts by text score', async function() {
    const response = await apos.http.get('/api/v1/@apostrophecms/page', {
      jar,
      qs: {
        autocomplete: 'zeb',
        type: 'test-page',
        perPage: 25,
        aposMode: 'draft'
      }
    });
    assert.deepEqual(titles(response.results), [ 'Zebra', 'Aardvark' ]);
  });

  it('piece REST API with autocomplete and suggestion limit sorts by text score', async function() {
    const response = await apos.http.get('/api/v1/test-piece', {
      jar,
      qs: {
        autocomplete: 'zeb',
        perPage: 25,
        aposMode: 'draft'
      }
    });
    assert.deepEqual(titles(response.results), [ 'Zebra', 'Aardvark' ]);
  });

  it('without autocomplete the suggestion sort is honored', async function() {
    const response = await apos.http.get('/api/v1/@apostrophecms/page', {
      jar,
      qs: {
        type: 'test-page',
        sort: { updatedAt: -1 },
        perPage: 25,
        aposMode: 'draft'
      }
    });
    assert.deepEqual(titles(response.results), [ 'Aardvark', 'Zebra' ]);
  });
});
