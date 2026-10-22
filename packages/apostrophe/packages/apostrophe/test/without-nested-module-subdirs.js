const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Without Nested Module Subdirs', function() {
  this.timeout(t.timeout);

  let apos;

  after(function () {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize', async function() {
    apos = await t.create({
      root: module,
      modules: {
        example1: {}
      }
    });
    assert(apos.modules.example1);
    // Should fail because we didn't turn on nestedModuleSubdirs,
    // so the index.js was not found and modules.js was not loaded
    assert(!apos.modules.example1.options.folderLevelOption);
    assert(!apos.modules.example1.initialized);
  });

});
