const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;
let jar;

describe('Http', function() {
  after(async function () {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  it('should exist on the apos object', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        'apostrophe-express': {
          options: {
            port: 7900
          }
        },
        'test': {
          apiRoutes: (self, options) => ({
            post: {
              '/csrf-test': (req) => {
                return {
                  ok: true
                };
              }
            }
          })
        }
      }
    });

    assert(apos.http);
    jar = apos.http.jar();
  });

  it('should be able to make an http request', async () => {
    const result = await apos.http.get('http://localhost:7900/', {
      jar
    });
    assert(result);
    assert(result.match(/logged out/));
  });

  it('should not be able to make an http POST request without csrf header', async () => {
    try {
      await apos.http.post('http://localhost:7900/csrf-test', {
        jar
      });
      assert(false);
    } catch (e) {
      assert(e.status === 403);
    }
  });

  it('should be able to make an http POST request with csrf header', async () => {
    const response = await apos.http.post('http://localhost:7900/csrf-test', {
      jar,
      headers: {
        'X-XSRF-TOKEN': apos.http.getCookie(jar, 'http://localhost:7900', 'test.csrf')
      },
      body: {}
    });
    assert(response.ok === true);
  });

  it('should be able to make an http POST request with csrf header via csrf convenience option to http.post', async () => {
    const response = await apos.http.post('http://localhost:7900/csrf-test', {
      jar,
      csrf: true,
      body: {}
    });
    assert(response.ok === true);
  });

});
