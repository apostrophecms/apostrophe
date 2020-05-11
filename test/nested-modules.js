var t = require('../test-lib/test.js');
var assert = require('assert');
var apos;

describe('Nested Modules', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      nestedModuleSubdirs: true,
      modules: {
        'apostrophe-test-module': {},
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900,
          csrf: false
        }
      },
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

  it('should have both apostrophe-test-module and nested-module-1', function() {
    assert(apos.modules['apostrophe-test-module']);
    assert(apos.modules['apostrophe-test-module'].color === 'red');
    // Option from modules.js
    assert(apos.modules['nested-module-1'].options.color === 'blue');
    // Option from index.js
    assert(apos.modules['nested-module-1'].options.size === 'large');
  });

});
