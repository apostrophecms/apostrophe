let t = require('../test-lib/test.js');
let assert = require('assert');
let apos;

describe('Soft Redirects', function() {

  this.timeout(t.timeout);

  after(async () => {
    return t.destroy(apos);
  });

  it('should exist', async () => {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 7900,
            secret: 'test'
          }
        },
        '@apostrophecms/pages': {
          options: {
            park: [
              {
                parkedId: 'child',
                title: 'Child',
                slug: '/child',
                type: 'default',
                published: true
              }
            ]
          }
        }
      }
    });
    assert(apos.modules['@apostrophecms/soft-redirects']);
  });

  it('should be able to serve the /child page (which also populates historicUrls)', async () => {
    const body = await apos.http.get('http://localhost:7900/child');
    // Did we get our page back?
    assert(body.match(/Default Page Template/));
  });

  it('should be able to change the URL via db', async () => {
    return apos.docs.db.updateOne({ slug: '/child' }, { $set: { slug: '/child-moved' } });
  });

  it('should be able to serve the page at its new URL', async () => {
    const body = await apos.http.get('http://localhost:7900/child-moved');
    // Did we get our page back?
    assert(body.match(/Default Page Template/));
  });

  it('should be able to serve the page at its old URL too, via redirect', async () => {
    const response = await apos.http.get('http://localhost:7900/child', {
      followRedirect: false,
      fullResponse: true,
      redirect: 'manual'
    });
    // Is our status code good?
    assert.equal(response.status, 302);
    // Are we going to be redirected to our page?
    assert.equal(response.headers['location'], 'http://localhost:7900/child-moved');
  });

});

describe('Soft Redirects - with `statusCode` option', async() => {

  after(async() => {
    return t.destroy(apos);
  });

  it('should exist', async () => {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },

      modules: {
        '@apostrophecms/express': {
          options: {
            port: 7900,
            secret: 'test'
          }
        },
        '@apostrophecms/pages': {
          options: {
            park: [
              {
                parkedId: 'child',
                title: 'Child',
                slug: '/child',
                type: 'default',
                published: true
              }
            ]
          }
        },
        '@apostrophecms/soft-redirects': {
          options: {
            statusCode: 301
          }
        }
      }
    });
    assert(apos.modules['@apostrophecms/soft-redirects']);
    assert.equal(apos.modules['@apostrophecms/soft-redirects'].options.statusCode, 301);
  });

  it('should be able to serve the /child page (which also populates historicUrls)', async () => {
    const body = await apos.http.get('http://localhost:7900/child');
    // Did we get our page back?
    assert(body.match(/Default Page Template/));
  });

  it('should be able to change the URL via db', async () => {
    return apos.docs.db.updateOne({ slug: '/child' }, { $set: { slug: '/child-moved' } });
  });

  it('should be able to serve the page at its new URL', async () => {
    const body = await apos.http.get('http://localhost:7900/child-moved');
    // Did we get our page back?
    assert(body.match(/Default Page Template/));
  });

  it('should be able to serve the page at its old URL too, via redirect', async () => {
    const response = await apos.http.get('http://localhost:7900/child', {
      fullResponse: true,
      redirect: 'manual'
    });
    // Is our status code good?
    assert.equal(response.status, 301);
    // Are we going to be redirected to our page?
    assert.equal(response.headers['location'], 'http://localhost:7900/child-moved');
  });

});
