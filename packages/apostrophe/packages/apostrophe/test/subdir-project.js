const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Project with package.json in its parent folder works', function() {

  this.timeout(t.timeout);

  /// ///
  // EXISTENCE
  /// ///

  it('should allow a project relying on a package.json in its parent folder', async function() {
    let apos;
    try {
      apos = await t.create(require('./subdir-project/app.js'));
      // Sniff test: a normal apos object
      assert(apos.user);
    } finally {
      if (apos) {
        await t.destroy(apos);
      }
    }
    assert(apos);
  });

});
