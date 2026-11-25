const t = require('../test-lib/test.js');
const assert = require('assert');

describe('CSRF protection against same-site, cross-origin requests', function() {

  let apos;
  let jar;

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
            csrf: {
              allowedOrigins: [ 'https://www.example.com/' ]
            }
          }
        },
        'csrf-test': {
          options: {
            csrfExceptions: [ 'excepted' ]
          },
          apiRoutes(self) {
            return {
              post: {
                async action(req) {
                  return { ok: true };
                },
                async excepted(req) {
                  return { ok: true };
                }
              }
            };
          }
        }
      }
    });
    jar = apos.http.jar();
    await apos.http.get('/', { jar });
  });

  async function postStatus(url, headers = {}) {
    try {
      await apos.http.post(url, {
        body: {},
        headers,
        jar
      });
      return 200;
    } catch (e) {
      return e.status;
    }
  }

  it('accepts an unsafe request with the CSRF cookie and no Sec-Fetch-Site header', async function() {
    assert.strictEqual(await postStatus('/api/v1/csrf-test/action'), 200);
  });

  it('accepts a same-origin unsafe request', async function() {
    assert.strictEqual(await postStatus('/api/v1/csrf-test/action', {
      'sec-fetch-site': 'same-origin'
    }), 200);
  });

  it('accepts a user-initiated unsafe request', async function() {
    assert.strictEqual(await postStatus('/api/v1/csrf-test/action', {
      'sec-fetch-site': 'none'
    }), 200);
  });

  it('rejects a same-site, cross-origin unsafe request even with the CSRF cookie', async function() {
    assert.strictEqual(await postStatus('/api/v1/csrf-test/action', {
      'sec-fetch-site': 'same-site',
      origin: 'https://evil.example.com'
    }), 403);
  });

  it('rejects a cross-site unsafe request even with the CSRF cookie', async function() {
    assert.strictEqual(await postStatus('/api/v1/csrf-test/action', {
      'sec-fetch-site': 'cross-site',
      origin: 'https://evil.example.net'
    }), 403);
  });

  it('accepts a same-site unsafe request from an allowed origin', async function() {
    assert.strictEqual(await postStatus('/api/v1/csrf-test/action', {
      'sec-fetch-site': 'same-site',
      origin: 'https://www.example.com'
    }), 200);
  });

  it('still rejects a same-site request from an allowed origin without the CSRF cookie', async function() {
    try {
      await apos.http.post('/api/v1/csrf-test/action', {
        body: {},
        headers: {
          'sec-fetch-site': 'same-site',
          origin: 'https://www.example.com'
        }
      });
      assert.fail('should have been rejected');
    } catch (e) {
      assert.strictEqual(e.status, 403);
    }
  });

  it('honors csrfExceptions for same-site requests', async function() {
    assert.strictEqual(await postStatus('/api/v1/csrf-test/excepted', {
      'sec-fetch-site': 'same-site',
      origin: 'https://evil.example.com'
    }), 200);
  });

  it('does not check Sec-Fetch-Site on safe requests', async function() {
    const response = await apos.http.get('/', {
      headers: {
        'sec-fetch-site': 'same-site'
      },
      jar
    });
    assert(response);
  });
});
