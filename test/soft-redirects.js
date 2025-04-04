const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Soft Redirects', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  it('should exist', async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/page': {
          options: {
            park: [
              {
                parkedId: 'child',
                title: 'Child',
                slug: '/child',
                type: 'default-page'
              }
            ]
          }
        },
        'default-page': {}
      }
    });
    assert(apos.modules['@apostrophecms/soft-redirect']);
  });

  it('should be able to serve the /child page (which also populates historicUrls)', async function() {
    const body = await apos.http.get('/child');
    // Did we get our page back?
    assert(body.match(/Default Page Template/));
  });

  it('should be able to change the URL via db', async function() {
    return apos.doc.db.updateOne({
      slug: '/child',
      aposLocale: 'en:published'
    }, { $set: { slug: '/child-moved' } });
  });

  it('should be able to serve the page at its new URL', async function() {
    const body = await apos.http.get('/child-moved');
    // Did we get our page back?
    assert(body.match(/Default Page Template/));
  });

  it('should be able to serve the page at its old URL too, via redirect', async function() {
    const response = await apos.http.get('/child', {
      followRedirect: false,
      fullResponse: true,
      redirect: 'manual'
    });
    // Is our status code good?
    assert.strictEqual(response.status, 302);
    // Are we going to be redirected to our page?
    assert.strictEqual(response.headers.location, `${apos.http.getBase()}/child-moved`);
  });

});

describe('Soft Redirects - with `statusCode` option', function() {
  let apos;
  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  it('should exist', async function() {
    apos = await t.create({
      root: module,

      modules: {
        '@apostrophecms/page': {
          options: {
            park: [
              {
                parkedId: 'child',
                title: 'Child',
                slug: '/child',
                type: 'default-page'
              }
            ]
          }
        },
        '@apostrophecms/soft-redirect': {
          options: {
            statusCode: 301
          }
        },
        'default-page': {}
      }
    });
    assert(apos.modules['@apostrophecms/soft-redirect']);
    assert.strictEqual(apos.modules['@apostrophecms/soft-redirect'].options.statusCode, 301);
  });

  it('should be able to serve the /child page (which also populates historicUrls)', async function() {
    const body = await apos.http.get('/child');
    // Did we get our page back?
    assert(body.match(/Default Page Template/));
  });

  it('should be able to change the URL via db', async function() {
    return apos.doc.db.updateOne({
      slug: '/child',
      aposLocale: 'en:published'
    }, {
      $set: {
        slug: '/child-moved'
      }
    });
  });

  it('should be able to serve the page at its new URL', async function() {
    const body = await apos.http.get('/child-moved');
    // Did we get our page back?
    assert(body.match(/Default Page Template/));
  });

  it('should be able to serve the page at its old URL too, via redirect', async function() {
    const response = await apos.http.get('/child', {
      fullResponse: true,
      redirect: 'manual'
    });
    // Is our status code good?
    assert.strictEqual(response.status, 301);
    // Are we going to be redirected to our page?
    assert.strictEqual(response.headers.location, `${apos.http.getBase()}/child-moved`);
  });
});
