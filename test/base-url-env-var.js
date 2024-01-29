const t = require('../test-lib/test.js');
const assert = require('assert');

const config = {
  root: module,
  // Should get overridden by the above
  baseUrl: 'http://localhost:3000'
};

describe('Locales', function() {
  this.timeout(t.timeout);
  let apos;
  let savedBaseUrl;

  before(async function() {
    savedBaseUrl = process.env.APOS_BASE_URL;
    process.env.APOS_BASE_URL = 'https://madethisup.com';
    apos = await t.create(config);
  });

  after(function() {
    if (savedBaseUrl) {
      process.env.APOS_BASE_URL = savedBaseUrl;
    } else {
      delete process.env.APOS_BASE_URL;
    }
    return t.destroy(apos);
  });

  it('APOS_BASE_URL should take effect', async function() {
    const req = apos.task.getReq();
    const home = await apos.doc.find(req, { slug: '/' }).toObject();
    assert(home);
    assert.strictEqual(home._url, 'https://madethisup.com/');
  });
});
