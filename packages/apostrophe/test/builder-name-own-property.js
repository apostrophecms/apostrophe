const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Request-supplied builder and api key names', function() {

  let apos;

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/express': {
          options: {
            apiKeys: {
              'test-key': {
                role: 'admin'
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
              _url: 1
            }
          }
        }
      }
    });
    const req = apos.task.getReq();
    await apos.article.insert(req, {
      ...apos.article.newInstance(),
      title: 'Article One'
    });
  });

  async function getStatus(url) {
    try {
      await apos.http.get(url);
      return 200;
    } catch (e) {
      return e.status;
    }
  }

  it('accepts a legitimate builder name', async function() {
    const response = await apos.http.get('/api/v1/article?sort=title');
    assert.strictEqual(response.results.length, 1);
  });

  it('ignores query parameters that are dot paths into builder definitions', async function() {
    for (const qs of [
      'sort.launder=x',
      'criteria.def=x',
      'title.launder=x',
      'perPage.launder=x'
    ]) {
      const status = await getStatus(`/api/v1/article?${qs}`);
      assert.strictEqual(status, 200, qs);
    }
  });

  it('ignores choices that are dot paths into builder definitions', async function() {
    const status = await getStatus('/api/v1/article?choices=sort.launder');
    assert.strictEqual(status, 200);
  });

  it('accepts a configured api key', async function() {
    const response = await apos.http.get('/api/v1/article?apikey=test-key&draft=1');
    assert.strictEqual(response.results.length, 1);
  });

  it('rejects an api key that is a dot path into the api key configuration', async function() {
    const status = await getStatus('/api/v1/article?apikey=test-key.role');
    assert.strictEqual(status, 403);
  });

  it('orderById does not treat ids as dot paths', function() {
    const items = [ { _id: 'a' } ];
    const result = apos.util.orderById([ 'a', 'a._id' ], items);
    assert.deepStrictEqual(result, [ { _id: 'a' } ]);
  });
});
