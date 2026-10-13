const t = require('../test-lib/test.js');
const assert = require('assert');

// GHSA-rqgm-cfrp-4hx8: for anonymous REST API requests restricted by
// `publicApiProjection`, query builders supplied in the query string must not
// operate on fields excluded by the projection. Otherwise the `sort` builder
// (and the per-field filter builders) can be used as an oracle to learn the
// values of fields the projection is meant to hide.

describe('Public API projection: sort and filter builders (GHSA-rqgm-cfrp-4hx8)', function() {

  let apos;
  const apiKey = 'public api projection builders test key';

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  const articles = [
    {
      title: 'Article A',
      secret: 50,
      secretNote: 'zzsecretalpha',
      privateNote: 'zzprivatealpha'
    },
    {
      title: 'Article B',
      secret: 10,
      secretNote: 'zzsecretbravo',
      privateNote: 'zzprivatebravo'
    },
    {
      title: 'Article C',
      secret: 90,
      secretNote: 'zzsecretcharlie',
      privateNote: 'zzprivatecharlie'
    },
    {
      title: 'Article D',
      secret: 30,
      secretNote: 'zzsecretdelta',
      privateNote: 'zzprivatedelta'
    },
    {
      title: 'Article E',
      secret: 70,
      secretNote: 'zzsecretecho',
      privateNote: 'zzprivateecho'
    }
  ];

  const titles = response => response.results.map(doc => doc.title);
  const bySecret = (direction) => [ ...articles ]
    .sort((a, b) => direction * (a.secret - b.secret))
    .map(article => article.title);

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
                name: 'secret-page',
                label: 'Secret Page'
              }
            ]
          }
        },
        'secret-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              secret: {
                type: 'integer',
                label: 'Secret'
              }
            }
          }
        },
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'article',
            publicApiProjection: {
              title: 1,
              slug: 1,
              _id: 1
            }
          },
          fields: {
            add: {
              secret: {
                type: 'integer',
                label: 'Secret'
              },
              secretNote: {
                type: 'string',
                label: 'Secret Note'
              },
              privateNote: {
                type: 'string',
                label: 'Private Note',
                searchable: false
              }
            }
          }
        }
      }
    });
  });

  it('should insert test content', async function() {
    const req = apos.task.getReq();
    for (const article of articles) {
      await apos.article.insert(req, {
        ...apos.article.newInstance(),
        ...article,
        visibility: 'public'
      });
    }
    const home = await apos.page.find(req, { level: 0 }).toObject();
    for (const article of articles) {
      await apos.page.insert(req, home._id, 'lastChild', {
        type: 'secret-page',
        title: article.title,
        secret: article.secret,
        visibility: 'public'
      });
    }
  });

  it('anonymous: the projection hides the secret fields', async function() {
    const response = await apos.http.get('/api/v1/article');
    assert.strictEqual(response.results.length, articles.length);
    for (const doc of response.results) {
      assert.strictEqual(doc.secret, undefined);
      assert.strictEqual(doc.secretNote, undefined);
    }
  });

  it('anonymous: cannot sort pieces by a field excluded by the projection', async function() {
    const ascending = await apos.http.get('/api/v1/article?sort[secret]=1');
    const descending = await apos.http.get('/api/v1/article?sort[secret]=-1');
    assert.strictEqual(ascending.results.length, articles.length);
    assert.notDeepStrictEqual(titles(ascending), bySecret(1));
    assert.notDeepStrictEqual(titles(descending), bySecret(-1));
    // The hidden sort is ignored entirely, so both requests agree
    assert.deepStrictEqual(titles(ascending), titles(descending));
  });

  it('anonymous: cannot sort pieces by a hidden string field', async function() {
    // secretNote values sort in a different order than titles do
    const ascending = await apos.http.get('/api/v1/article?sort[secretNote]=1');
    const descending = await apos.http.get('/api/v1/article?sort[secretNote]=-1');
    assert.deepStrictEqual(titles(ascending), titles(descending));
  });

  it('anonymous: can still sort pieces by a projected field', async function() {
    const ascending = await apos.http.get('/api/v1/article?sort[title]=1');
    const descending = await apos.http.get('/api/v1/article?sort[title]=-1');
    const expected = articles.map(article => article.title).sort();
    assert.deepStrictEqual(titles(ascending), expected);
    assert.deepStrictEqual(titles(descending), [ ...expected ].reverse());
  });

  it('anonymous: a hidden sort key is dropped but projected keys are kept', async function() {
    const response = await apos.http.get('/api/v1/article?sort[secret]=1&sort[title]=-1');
    const expected = articles.map(article => article.title).sort().reverse();
    assert.deepStrictEqual(titles(response), expected);
  });

  it('anonymous: cannot filter pieces by a field excluded by the projection', async function() {
    const response = await apos.http.get('/api/v1/article?secret=50');
    // The filter is ignored, rather than confirming which doc has secret: 50
    assert.strictEqual(response.results.length, articles.length);
    const range = await apos.http.get('/api/v1/article?secret[0]=45&secret[1]=55');
    assert.strictEqual(range.results.length, articles.length);
  });

  it('anonymous: can still filter pieces by a projected field', async function() {
    const response = await apos.http.get('/api/v1/article?title=Article%20C');
    assert.deepStrictEqual(titles(response), [ 'Article C' ]);
  });

  it('anonymous: cannot sort pages by a field excluded by the projection', async function() {
    apos.page.options.publicApiProjection = {
      title: 1,
      slug: 1,
      _url: 1
    };
    try {
      const ascending = await apos.http.get('/api/v1/@apostrophecms/page?type=secret-page&sort[secret]=1');
      const descending = await apos.http.get('/api/v1/@apostrophecms/page?type=secret-page&sort[secret]=-1');
      assert.strictEqual(ascending.results.length, articles.length);
      assert.strictEqual(ascending.results[0].secret, undefined);
      assert.notDeepStrictEqual(titles(ascending), bySecret(1));
      assert.deepStrictEqual(titles(ascending), titles(descending));
      // Projected fields remain sortable
      const byTitle = await apos.http.get('/api/v1/@apostrophecms/page?type=secret-page&sort[title]=-1');
      assert.deepStrictEqual(
        titles(byTitle),
        articles.map(article => article.title).sort().reverse()
      );
    } finally {
      delete apos.page.options.publicApiProjection;
    }
  });

  it('anonymous: related pages (_ancestors, _children) are limited to the projection', async function() {
    const req = apos.task.getReq();
    const parent = await apos.page.find(req, { title: 'Article A' }).toObject();
    const child = await apos.page.insert(req, parent._id, 'lastChild', {
      type: 'secret-page',
      title: 'Child Page',
      secret: 12345,
      visibility: 'public'
    });
    // `path` is needed for ancestors and children to be loaded at all
    apos.page.options.publicApiProjection = {
      title: 1,
      slug: 1,
      path: 1,
      level: 1,
      rank: 1,
      _url: 1
    };
    try {
      const withChildren = await apos.http.get(`/api/v1/@apostrophecms/page/${parent._id}`);
      assert.strictEqual(withChildren.secret, undefined);
      assert.strictEqual(withChildren._children.length, 1);
      assert.strictEqual(withChildren._children[0].title, 'Child Page');
      assert.strictEqual(withChildren._children[0].secret, undefined);
      const deeper = await apos.http.get(`/api/v1/@apostrophecms/page/${parent._id}?children[depth]=2`);
      assert.strictEqual(deeper._children[0].secret, undefined);
      const withAncestors = await apos.http.get(`/api/v1/@apostrophecms/page/${child._id}`);
      assert.strictEqual(withAncestors.secret, undefined);
      const ancestor = withAncestors._ancestors.find(page => page.title === 'Article A');
      assert(ancestor);
      assert.strictEqual(ancestor.secret, undefined);
    } finally {
      delete apos.page.options.publicApiProjection;
      await apos.page.delete(req, child);
    }
  });

  it('API key (not restricted by the projection): can sort and filter by any field', async function() {
    const ascending = await apos.http.get(`/api/v1/article?apikey=${apiKey}&sort[secret]=1`);
    assert.deepStrictEqual(titles(ascending), bySecret(1));
    const filtered = await apos.http.get(`/api/v1/article?apikey=${apiKey}&secret=50`);
    assert.deepStrictEqual(titles(filtered), [ 'Article A' ]);
    const pages = await apos.http.get(`/api/v1/@apostrophecms/page?apikey=${apiKey}&type=secret-page&sort[secret]=-1`);
    assert.deepStrictEqual(titles(pages), bySecret(-1));
  });

  // Full text search is intentionally NOT restricted by the projection: the
  // site's full text index (also used by the public @apostrophecms/search
  // page) covers every field not marked `searchable: false`. These tests
  // document that behavior: developers must mark sensitive text fields
  // `searchable: false`.

  it('anonymous: full text search matches searchable fields, documenting current behavior', async function() {
    const response = await apos.http.get('/api/v1/article?search=zzsecretalpha');
    assert.deepStrictEqual(titles(response), [ 'Article A' ]);
    assert.strictEqual(response.results[0].secretNote, undefined);
  });

  it('anonymous: full text search does not match fields marked searchable: false', async function() {
    const response = await apos.http.get('/api/v1/article?search=zzprivatealpha');
    assert.strictEqual(response.results.length, 0);
  });

  // Search results must still be sorted by search quality, including when a
  // sort on a hidden field is requested and dropped.

  it('anonymous: full text search results are sorted by search quality', async function() {
    const req = apos.task.getReq();
    // Inserted from best to worst match, so that the default sort
    // (most recently updated first) is the reverse of search quality
    const ranked = [
      {
        title: 'Rank zzranked zzranked zzranked',
        secret: 3
      },
      {
        title: 'Rank zzranked',
        secret: 2
      },
      {
        title: 'Rank Note Only',
        secretNote: 'zzranked',
        secret: 1
      }
    ];
    for (const article of ranked) {
      await apos.article.insert(req, {
        ...apos.article.newInstance(),
        ...article,
        visibility: 'public'
      });
    }
    const expected = (await apos.article.find(req).search('zzranked').toArray())
      .map(doc => doc.title);
    assert.deepStrictEqual(expected, ranked.map(article => article.title));

    const response = await apos.http.get('/api/v1/article?search=zzranked');
    assert.deepStrictEqual(titles(response), expected);
    const hiddenSort = await apos.http.get('/api/v1/article?search=zzranked&sort[secret]=1');
    assert.deepStrictEqual(titles(hiddenSort), expected);
  });
});
