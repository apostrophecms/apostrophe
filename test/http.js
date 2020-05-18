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
    apos = await t.create({
      root: module,
      modules: {
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
    const result = await apos.http.get('/', {
      jar
    });
    assert(result);
    assert(result.match(/logged out/));
  });

  it('should not be able to make an http POST request without csrf header', async () => {
    try {
      await apos.http.post('/csrf-test', {
        jar,
        csrf: false
      });
      assert(false);
    } catch (e) {
      assert(e.status === 403);
    }
  });

  it('should be able to make an http POST request with manually built csrf header', async () => {
    const response = await apos.http.post('/csrf-test?manual=1', {
      jar,
      headers: {
        'X-XSRF-TOKEN': apos.http.getCookie(jar, '/', `${apos.options.shortName}.csrf`)
      },
      body: {},
      csrf: false
    });
    assert(response.ok === true);
  });

  it('should be able to make an http POST request with csrf header via default csrf convenience of http.post', async () => {
    const response = await apos.http.post('/csrf-test', {
      jar,
      body: {}
    });
    assert(response.ok === true);
  });

});
