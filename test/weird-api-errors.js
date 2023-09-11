const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Don\'t crash on weird API errors', function() {

  after(async function() {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  let apos;

  it('should initialize apos', async function() {
    apos = await t.create({
      root: module,
      modules: {
        'api-test': {
          apiRoutes(self) {
            return {
              get: {
                fetchItFine(req) {
                  return {
                    nifty: true
                  };
                },
                fetchItFailWeird(req) {
                  throw 'not-an-error-object';
                },
                fetchItFailNormal(req) {
                  throw new Error('normal error');
                }
              }
            };
          }
        }
      }
    });
  });
  it('should fetch fine in the normal case', async function() {
    const body = await apos.http.get('/api/v1/api-test/fetch-it-fine', {});
    assert(typeof body === 'object');
    assert.strictEqual(body.nifty, true);
  });
  it('should fail politely in the weird case of a non-Error exception', async function() {
    let msgWas;
    const consoleError = console.error;
    console.error = msg => {
      msgWas = msg;
    };
    try {
      await apos.http.get('/api/v1/api-test/fetch-it-fail-weird', {});
      // Should not get here
      assert(false);
    } catch (e) {
      // Make sure the logging system itself is not at fault
      assert(!msgWas.toString().includes('Structured logging error'));
    } finally {
      console.error = consoleError;
      console.error(msgWas);
    }
  });
  it('should fail politely in the normal case of an Error exception', async function() {
    let msgWas;
    const consoleError = console.error;
    console.error = msg => {
      msgWas = msg;
    };
    try {
      await apos.http.get('/api/v1/api-test/fetch-it-fail-normal', {});
      // Should not get here
      assert(false);
    } catch (e) {
      // Make sure the logging system itself is not at fault
      assert(!msgWas.toString().includes('Structured logging error'));
    } finally {
      console.error = consoleError;
      console.error(msgWas);
    }
  });
});
