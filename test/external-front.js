const t = require('../test-lib/test.js');
const assert = require('assert');

describe('External Front', function() {

  let apos;
  // Set env var so these tests work even if you have a dev key in your bashrc etc.
  process.env.APOS_EXTERNAL_FRONT_KEY = 'this is a test external front key';

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  it('apostrophe should initialize normally', async function() {
    apos = await t.create({
      root: module
    });

    assert(apos.page.__meta.name === '@apostrophecms/page');
  });

  it('fetch home with external front', async function() {
    const data = await await apos.http.get('/', {
      headers: {
        'x-requested-with': 'AposExternalFront',
        'apos-external-front-key': process.env.APOS_EXTERNAL_FRONT_KEY
      }
    });
    assert.strictEqual(typeof data, 'object');
    assert(data.page);
    assert(data.home);
    assert(data.page.slug === data.home.slug);
    assert(data.page.slug === '/');
  });

  it('fetch home normally', async function() {
    const data = await await apos.http.get('/', {});
    assert.strictEqual(typeof data, 'string');
    assert(data.includes('Home Page Template'));
  });
});
