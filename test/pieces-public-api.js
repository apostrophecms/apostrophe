const t = require('../test-lib/test.js');
const assert = require('assert');

let apos;

describe('Pieces Public API', function() {

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
        thing: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'thing',
            label: 'Thing'
          },
          fields: {
            add: {
              foo: {
                label: 'Foo',
                type: 'string'
              }
            }
          }
        }
      }
    });
    assert(apos.modules.thing);
    assert(apos.modules.thing.schema);
  });

  const testThing = {
    _id: 'testThing:en:published',
    title: 'hello',
    foo: 'bar',
    visibility: 'public'
  };

  it('should be able to insert a piece into the database', async () => {
    await apos.thing.insert(apos.task.getReq(), testThing);
    const thing = await apos.thing.find(apos.task.getReq(), { _id: 'testThing:en:published' }).toObject();
    assert(thing);
  });

  it('should not be able to anonymously retrieve a piece by id from the database without a public API projection', async () => {
    try {
      await apos.http.get('/api/v1/thing');
      // Bad, we expected a 404
      assert(false);
    } catch (e) {
      assert(e.status === 404);
    }
  });

  it('should be able to anonymously retrieve a piece by id from the database with a public API projection', async () => {
    // Patch the option setting to simplify the test code
    apos.thing.options.publicApiProjection = {
      title: 1,
      _url: 1
    };
    const response = await apos.http.get('/api/v1/thing');
    assert(response);
    assert(response.results);
    assert(response.results.length === 1);
    assert(response.results[0].title === 'hello');
    assert(!response.results[0].foo);
  });

  it('should not set a "max-age" cache-control value when retrieving pieces, when cache option is not set, with a public API projection', async () => {
    apos.thing.options.publicApiProjection = {
      title: 1,
      _url: 1
    };

    const response1 = await apos.http.get('/api/v1/thing', { fullResponse: true });
    const response2 = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    assert(response1.headers['cache-control'] === undefined);
    assert(response2.headers['cache-control'] === undefined);
  });

  it('should not set a "max-age" cache-control value when retrieving a single piece, when "etags" cache option is set, with a public API projection', async () => {
    apos.thing.options.publicApiProjection = {
      title: 1,
      _url: 1
    };
    apos.thing.options.cache = {
      api: {
        maxAge: 2222
      },
      etags: true
    };

    const response = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    assert(response.headers['cache-control'] === undefined);
  });

  it('should set a "max-age" cache-control value when retrieving pieces, with a public API projection', async () => {
    apos.thing.options.publicApiProjection = {
      title: 1,
      _url: 1
    };
    apos.thing.options.cache = {
      api: {
        maxAge: 2222
      }
    };

    const response1 = await apos.http.get('/api/v1/thing', { fullResponse: true });
    const response2 = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    assert(response1.headers['cache-control'] === 'max-age=2222');
    assert(response2.headers['cache-control'] === 'max-age=2222');

    delete apos.thing.options.cache;
  });

  it('should set a custom etag when retrieving a single piece', async () => {
    apos.thing.options.publicApiProjection = {
      title: 1,
      _url: 1
    };
    apos.thing.options.cache = {
      api: {
        maxAge: 1111
      },
      etags: true
    };

    const response = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    const eTagParts = response.headers.etag.split(':');

    assert(eTagParts[0] === apos.asset.getReleaseId());
    assert(eTagParts[1] === (new Date(response.body.cacheInvalidatedAt)).getTime().toString());
    assert(eTagParts[2]);

    delete apos.thing.options.cache;
  });

});
