var assert = require('assert');
var t = require('./testUtils');

var apos;

describe('Templates', function(){

  this.timeout(5000);

  after(function(done) {
    return destroy(apos, done);
  });

  it('should have a push property', function(done) {
  	apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900
        }
      },
      afterInit: function(callback) {
        assert(apos.push);
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        // assert(!err);
        done();
      }
    });
  });

  it('should be able to push a browser call and get back an HTML-safe JSON string', function() {
    var req = t.req.anon(apos);
    req.browserCall('test(?)', { data: '<script>alert(\'ruh roh\');</script>' });
    var calls = req.getBrowserCalls();
    assert(calls.indexOf('<\\/script>') !== -1);
    assert(calls.indexOf('</script>') === -1);
  });
});
