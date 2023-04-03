const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

describe('Soft Redirects', function() {

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

describe('Soft Redirects - draft saved with a different slug than the published version', function() {
  let jar;
  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,

      modules: {
        '@apostrophecms/soft-redirect': {
          options: {
            statusCode: 302
          }
        },
        'default-page': {},
        product: {
          extend: '@apostrophecms/piece-type'
        },
        'product-page': {
          extend: '@apostrophecms/piece-page-type',
          options: {
            name: 'productPage',
            label: 'Products',
            alias: 'productPage',
            perPage: 10
          }
        },
        '@apostrophecms/page': {
          options: {
            park: [
              {
                title: 'Products',
                type: 'productPage',
                slug: '/products',
                parkedId: 'products'
              }
            ]
          }
        }
      }
    });

    await t.createAdmin(apos);
    jar = await t.getUserJar(apos);
  });

  after(async function() {
    return t.destroy(apos);
  });

  it('should be able to redirect the page at its old URL', async function() {
    const req = apos.task.getReq({ mode: 'draft' });

    const { aposDocId } = await apos.page.insert(req, '_home', 'lastChild', {
      type: 'default-page',
      title: 'Page',
      slug: '/page-old'
    });

    await apos.doc.db.updateOne({
      slug: '/page-old',
      aposLocale: 'en:draft'
    }, {
      $set: {
        slug: '/page-new'
      }
    });

    const response = await apos.http.get(`/page-old?aposMode=draft&aposRefresh=1&aposDocId=${aposDocId}&aposEdit=1`, {
      redirect: 'manual',
      fullResponse: true,
      jar
    });

    assert.strictEqual(response.status, 302);
    assert.strictEqual(response.headers.location, `${apos.http.getBase()}/page-new`);
  });

  it('should be able to redirect the piece at its old URL', async function() {
    const req = apos.task.getReq({ mode: 'draft' });

    const { aposDocId } = await apos.modules.product.insert(req, {
      title: 'Product',
      slug: 'product-old'
    });

    await apos.doc.db.updateOne({
      slug: 'product-old',
      aposLocale: 'en:draft'
    }, {
      $set: {
        slug: 'product-new'
      }
    });

    const response = await apos.http.get(`/products/product-old?aposMode=draft&aposRefresh=1&aposDocId=${aposDocId}&aposEdit=1`, {
      redirect: 'manual',
      fullResponse: true,
      jar
    });

    assert.strictEqual(response.status, 302);
    assert.strictEqual(response.headers.location, `${apos.http.getBase()}/products/product-new`);
  });

});
