var t = require('../test-lib/test.js');
var assert = require('assert');

describe('Launder', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  var apos;

  it('should exist on the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      afterInit: function(callback) {
        assert(apos.launder);
        return done();
      }
    });
  });

  // Launder has plenty of unit tests of its own. All we're
  // doing here is a sanity test that we're really
  // hooked up to launder.

  it('should launder a number to a string', function() {
    assert(apos.launder.string(5) === '5');
  });
});
