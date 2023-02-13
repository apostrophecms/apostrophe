const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;
let savedBaseUrl;

describe('APOS_BASE_URL environment variable', function() {

  this.timeout(t.timeout);

  before(function(done) {
    savedBaseUrl = process.env.APOS_BASE_URL;
    process.env.APOS_BASE_URL = 'https://madethisup.com';
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      afterInit: function(callback) {
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  after(function(done) {
    if (savedBaseUrl) {
      process.env.APOS_BASE_URL = savedBaseUrl;
    } else {
      delete process.env.APOS_BASE_URL;
    }
    return t.destroy(apos, done);
  });

  it('should respect APOS_BASE_URL', async function() {
    const req = apos.tasks.getReq();
    const home = await apos.docs.find(req, { slug: '/' }).toObject();
    assert(home);
    assert.strictEqual(home._url, 'https://madethisup.com/');
  });
});
