const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Pages Public API', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function () {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should be a property of the apos object', async function() {
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
          extend: '@apostrophecms/page-type'
        }
      }
    });

    assert(apos.page.__meta.name === '@apostrophecms/page');
  });

  it('cannot GET the home page without session without publicApiProjection', async function() {
    try {
      await apos.http.get('/api/v1/@apostrophecms/page', {});
      // Getting here would be bad
      assert(false);
    } catch (e) {
      assert(e.status === 404);
    }
  });

  it('can GET the home page without session with publicApiProjection', async function() {
    // Patch the option to simplify test
    apos.page.options.publicApiProjection = {
      title: 1,
      _url: 1,
      path: 1,
      level: 1,
      rank: 1
    };

    const home = await apos.http.get('/api/v1/@apostrophecms/page', {});
    assert(home);
    // But projection did apply
    assert(!home.searchSummary);
  });

  it('should not set a "max-age" cache-control value when retrieving pages, when cache option is not set, with a public API projection', async function() {
    apos.page.options.publicApiProjection = {
      title: 1,
      _url: 1
    };

    const response1 = await apos.http.get('/api/v1/@apostrophecms/page', { fullResponse: true });
    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${response1.body._id}`, { fullResponse: true });

    assert(response1.headers['cache-control'] === undefined);
    assert(response2.headers['cache-control'] === undefined);
  });

  it('should not set a "max-age" cache-control value when retrieving a single page, when "etags" cache option is set, with a public API projection', async function() {
    apos.page.options.publicApiProjection = {
      title: 1,
      _url: 1
    };
    apos.page.options.cache = {
      api: {
        maxAge: 1111,
        etags: true
      }
    };

    const response1 = await apos.http.get('/api/v1/@apostrophecms/page', { fullResponse: true });
    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${response1.body._id}`, { fullResponse: true });

    assert(response2.headers['cache-control'] === undefined);

    delete apos.page.options.cache;
  });

  it('should set a "max-age" cache-control value when retrieving pages, with a public API projection', async function() {
    apos.page.options.publicApiProjection = {
      title: 1,
      _url: 1
    };
    apos.page.options.cache = {
      api: {
        maxAge: 1111
      }
    };

    const response1 = await apos.http.get('/api/v1/@apostrophecms/page', { fullResponse: true });
    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${response1.body._id}`, { fullResponse: true });

    assert(response1.headers['cache-control'] === 'max-age=1111');
    assert(response2.headers['cache-control'] === 'max-age=1111');

    delete apos.page.options.cache;
  });

  it('should set a custom etag when retrieving a single page', async function() {
    apos.page.options.publicApiProjection = {
      title: 1,
      _url: 1
    };
    apos.page.options.cache = {
      api: {
        maxAge: 1111,
        etags: true
      }
    };

    const response1 = await apos.http.get('/api/v1/@apostrophecms/page', { fullResponse: true });
    const response2 = await apos.http.get(`/api/v1/@apostrophecms/page/${response1.body._id}`, { fullResponse: true });

    const eTagParts = response2.headers.etag.split(':');

    assert(eTagParts[0] === apos.asset.getReleaseId());
    assert(eTagParts[1] === (new Date(response2.body.cacheInvalidatedAt)).getTime().toString());
    assert(eTagParts[2]);

    delete apos.page.options.cache;
  });
});
