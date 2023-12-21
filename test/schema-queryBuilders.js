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
});

function seedArticles(instance) {
  const moduleName = instance.__meta.name;
  return [
    {
      title: 'One',
      float: 1.1
    },
    {
      title: 'Two',
      float: 2.2
    },
    {
      title: 'Three',
      float: 3.3
    },
    {
      title: 'Four',
      float: 4.4
    },
    {
      title: 'Five',
      float: 5.5
    },
    {
      title: 'Six',
      float: 6.6
    },
    {
      title: 'Seven',
      float: 7.7
    },
    {
      title: 'Eight',
      float: 8.8
    },
    {
      title: 'Nine',
      float: 9.9
    },
    {
      title: 'Ten',
      float: 10.0
    }
  ].map((a, i) => ({
    _id: `${moduleName}${i}`,
    ...instance.newInstance(),
    slug: `${moduleName}-${a.title.toLowerCase()}`,
    ...a
  }));
};
