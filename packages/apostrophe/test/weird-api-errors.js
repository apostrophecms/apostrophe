const t = require('../test-lib/test.js');
const assert = require('assert');

// Errors are rendered to stderr by the logger, not by the console.
async function capturedStderr(fn) {
  const chunks = [];
  const stderr = process.stderr.write;
  process.stderr.write = (chunk) => {
    chunks.push(chunk);
    return true;
  };
  try {
    await fn();
  } finally {
    process.stderr.write = stderr;
  }
  return chunks.join('');
}

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
    let failed = false;
    const logged = await capturedStderr(async () => {
      try {
        await apos.http.get('/api/v1/api-test/fetch-it-fail-weird', {});
      } catch (e) {
        failed = true;
      }
    });
    assert(failed);
    // Make sure the logging system itself is not at fault
    assert(!logged.includes('Structured logging error'));
  });
  it('should fail politely in the normal case of an Error exception', async function() {
    let failed = false;
    const logged = await capturedStderr(async () => {
      try {
        await apos.http.get('/api/v1/api-test/fetch-it-fail-normal', {});
      } catch (e) {
        failed = true;
      }
    });
    assert(failed);
    // Make sure the logging system itself is not at fault
    assert(!logged.includes('Structured logging error'));
  });
});
