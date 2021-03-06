const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Launder', function() {

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  let apos;

  it('should exist on the apos object', async function() {
    apos = await t.create({
      root: module
    });

    assert(apos.launder);
  });

  // Launder has plenty of unit tests of its own. All we're
  // doing here is a sanity test that we're really
  // hooked up to launder.

  it('should launder a number to a string', function() {
    assert(apos.launder.string(5) === '5');
  });
});
