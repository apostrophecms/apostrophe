const t = require('../test-lib/test.js');
const assert = require('assert');

describe('With Nested Module Subdirs', function() {
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
      nestedModuleSubdirs: true,
      modules: {
        example1: {}
      }
    });
    assert(apos.modules.example1);
    // With nestedModuleSubdirs switched on, the index.js should be found,
    // and modules.js should be loaded
    assert(apos.modules.example1.options.folderLevelOption);
    assert(apos.modules.example1.initialized);
  });

});
