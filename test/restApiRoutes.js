let t = require('../test-lib/test.js');
let assert = require('assert');

const request = require('request-promise');

describe('REST API routing', function() {

  after(async function() {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  let apos;
  let jar = request.jar();

  it('should initialize apos', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 7900
          }
        },
        'rest-test': {
          restApiRoutes(self, options) {
            return {
              getAll(req) {
                return {
                  action: 'getAll',
                };
              },
              getOne(req, _id) {
                return {
                  action: 'getOne',
                  _id
                };
              },
              post(req) {
                return {
                  action: 'post',
                  data: req.body
                };
              },
              delete(req, _id) {
                return {
                  action: 'delete',
                  _id
                };
              },
              patch(req, _id) {
                return {
                  action: 'patch',
                  _id
                };
              },
              put(req, _id) {
                return {
                  action: 'put',
                  _id
                };
              }
            };
          }
        }
      }
    });
  });
  it('should respond properly to getAll', async () => {
    const body = JSON.parse(await request('http://localhost:7900/api/v1/rest-test', {
      method: 'GET',
      // Establish CSRF cookie in jar
      jar
    }));
    // We're just testing the routing, we don't actually get back a list of things,
    // we'll test that with pieces
    assert(body.action === 'getAll');
  });
  it('should respond properly to post', async () => {
    const body = JSON.parse(await request('http://localhost:7900/api/v1/rest-test', {
      method: 'POST',
      // Use the cookie jar because CSRF tokens are required
      jar,
      headers: {
        'X-XSRF-TOKEN': getCsrfToken(jar)
      }
    }));
    assert(body.action === 'post');
  });
  it('should respond properly to delete', async () => {
    const body = JSON.parse(await request('http://localhost:7900/api/v1/rest-test/1000', {
      method: 'DELETE',
      jar,
      headers: {
        'X-XSRF-TOKEN': getCsrfToken(jar)
      }
    }));
    assert(body.action === 'delete');
    assert(body._id === '1000');
  });
  it('should respond properly to patch', async () => {
    const body = JSON.parse(await request('http://localhost:7900/api/v1/rest-test/1000', {
      method: 'PATCH',
      jar,
      headers: {
        'X-XSRF-TOKEN': getCsrfToken(jar)
      }
    }));
    assert(body.action === 'patch');
    assert(body._id === '1000');
  });
  it('should respond properly to put', async () => {
    const body = JSON.parse(await request('http://localhost:7900/api/v1/rest-test/1000', {
      method: 'PUT',
      jar,
      headers: {
        'X-XSRF-TOKEN': getCsrfToken(jar)
      }
    }));
    assert(body.action === 'put');
    assert(body._id === '1000');
  });
  it('should respond properly to getOne', async () => {
    const body = JSON.parse(await request('http://localhost:7900/api/v1/rest-test/1000', {
      method: 'GET',
      jar
    }));
    assert(body.action === 'getOne');
    assert(body._id === '1000');
  });

  function getCsrfToken(jar) {
    const csrfCookie = jar.getCookies('http://localhost:7900/').find(cookie => cookie.key === apos.csrfCookieName);
    if (!csrfCookie) {
      return null;
    }
    const csrfToken = csrfCookie.value;
    return csrfToken;
  }

});
