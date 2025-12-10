const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Improve Overrides', function() {

  this.timeout(t.timeout);

  it('"improve" should work, but project level should override it', async function() {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          'improve-piece-type': {},
          'improve-global': {}
        }
      });
      assert(apos.global.options.verifyProjectLevelLoaded);
      assert.strictEqual(apos.user.options.testPieceTypeLevelLoaded, true);
      assert.strictEqual(apos.user.options.testPieceTypeLevel, true);
      assert.strictEqual(apos.global.options.testPieceTypeLevelLoaded, true);
      assert.strictEqual(apos.global.options.testPieceTypeLevel, false);
      assert.strictEqual(apos.global.options.testGlobalLevelLoaded, true);
      assert.strictEqual(apos.global.options.testGlobalLevel, false);
    } finally {
      t.destroy(apos);
    }
  });

});
