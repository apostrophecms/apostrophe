const t = require('../test-lib/test.js');
const assert = require('assert');

let apos;

describe('Pages Public API', function() {

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
        }
      }
    });

    assert(apos.page.__meta.name === '@apostrophecms/page');
  });

  it('cannot GET the home page without session without publicApiProjection', async () => {
    try {
      await apos.http.get('/api/v1/@apostrophecms/page', {});
      // Getting here would be bad
      assert(false);
    } catch (e) {
      assert(e.status === 404);
    }
  });

  it('can GET the home page without session with publicApiProjection', async () => {
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
});
