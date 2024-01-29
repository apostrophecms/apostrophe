const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Http', function() {

  let apos;
  let jar;

  after(async function () {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  it('should exist on the apos object', async function() {
    apos = await t.create({
      root: module,
      modules: {
        test: {
          apiRoutes: (self) => ({
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

  it('should be able to make an http request', async function() {
    const result = await apos.http.get('/', {
      jar
    });
    assert(result);
    assert(result.match(/logged out/));
  });

  it('should be able to make an http POST request with csrf header via default csrf convenience of http.post', async function() {
    const response = await apos.http.post('/csrf-test', {
      jar,
      body: {}
    });
    assert(response.ok === true);
  });

});
