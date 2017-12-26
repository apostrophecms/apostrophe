var t = require('../test-lib/test.js');
var assert = require('assert');

var apos;

describe('Db', function(){

  after(function(done) {
    return t.destroy(apos, done);
  });

  this.timeout(t.timeout);

  it('should exist on the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
      afterInit: function(callback) {
        assert(apos.db);
        return done();
      }
    });
  });
});
