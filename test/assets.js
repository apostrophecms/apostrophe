const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

describe('Assets', function() {

  after(async function() {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  it('should should exist on the apos object', async function() {
    apos = await t.create({
      root: module
    });
    assert(apos.asset);
  });

  it('should serve static files', async function() {
    const text = await apos.http.get('/static-test.txt');
    assert(text.match(/served/));
  });

});
