const t = require('../test-lib/test.js');
const assert = require('assert');

const apikey = 'this is a test api key';

describe('Schema Field Query Builders', function() {
  this.timeout(t.timeout);

  let apos;
  after(function() {
    return t.destroy(apos);
  });

  before(async function () {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/express': {
          options: {
            apiKeys: {
              [apikey]: {
                role: 'admin'
              }
            }
          }
        },
        article: {
          options: {
            alias: 'article'
          },
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              float: {
                label: 'Float',
                type: 'float',
                required: true
              },
              integers: {
                label: 'Integers',
                type: 'integer',
                required: true
              }
            }
          }
        }
      }
    });
  });

  it('should insert article pieces and verify a piece can be retrieved by the float query builder', async function() {
    const articles = seedArticles(apos.article);
    await apos.doc.db.insertMany(articles);
    const article = articles[0];

    const queriedArticle = await apos.http.get('/api/v1/article', {
      qs: {
        float: [ 1.1 ],
        apikey: [ apikey ]
      }
    });
    assert.strictEqual(queriedArticle.results.length, 1);
    assert.strictEqual(queriedArticle.results[0].title, article.title);
  });

  it('should verify a range of pieces can be retrieved by the float query builder', async function() {
    const queriedArticles = await apos.http.get('/api/v1/article', {
      qs: {
        float: [ 1, 4 ],
        apikey: [ apikey ]
      }
    });
    assert.strictEqual(queriedArticles.results.length, 3);
  });

  it('should not retrieve any documents if they are outside the specified range of the float query', async function() {
    const queriedArticles = await apos.http.get('/api/v1/article', {
      qs: {
        float: [ 11, 40 ],
        apikey: [ apikey ]
      }
    });
    assert.strictEqual(queriedArticles.results.length, 0);
  });

  it('should retrieve a single document with the integer query builder', async function() {
    const articles = seedArticles(apos.article);
    const article = articles[0];

    const queriedArticle = await apos.http.get('/api/v1/article', {
      qs: {
        integers: 1,
        apikey: [ apikey ]
      }
    });
    assert.strictEqual(queriedArticle.results.length, 1);
    assert.strictEqual(queriedArticle.results[0].title, article.title);
  });

  it('should verify a range of pieces can be retrieved by the integer query builder', async function() {
    const queriedArticles = await apos.http.get('/api/v1/article', {
      qs: {
        integers: [ 1, 3 ],
        apikey: [ apikey ]
      }
    });
    assert.strictEqual(queriedArticles.results.length, 3);
  });

  it('should not retrieve any documents if they are outside the specified range of the integer query', async function() {
    const queriedArticles = await apos.http.get('/api/v1/article', {
      qs: {
        integers: [ 11, 40 ],
        apikey: [ apikey ]
      }
    });
    assert.strictEqual(queriedArticles.results.length, 0);
  });
});

function seedArticles(instance) {
  const moduleName = instance.__meta.name;
  return [
    {
      title: 'One',
      float: 1.1,
      integers: 1
    },
    {
      title: 'Two',
      float: 2.2,
      integers: 2
    },
    {
      title: 'Three',
      float: 3.3,
      integers: 3
    },
    {
      title: 'Four',
      float: 4.4,
      integers: 4
    },
    {
      title: 'Five',
      float: 5.5,
      integers: 5
    },
    {
      title: 'Six',
      float: 6.6,
      integers: 6
    },
    {
      title: 'Seven',
      float: 7.7,
      integers: 7
    },
    {
      title: 'Eight',
      float: 8.8,
      integers: 8
    },
    {
      title: 'Nine',
      float: 9.9,
      integers: 9
    },
    {
      title: 'Ten',
      float: 10.0,
      integers: 10
    }
  ].map((a, i) => ({
    _id: `${moduleName}${i}`,
    ...instance.newInstance(),
    slug: `${moduleName}-${a.title.toLowerCase()}`,
    ...a
  }));
};
