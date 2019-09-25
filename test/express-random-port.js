var t = require('../test-lib/test.js');
var assert = require('assert');
var apos;
var temporaryServer;

describe('Express', function() {

  this.timeout(t.timeout);

  before(function() {
    // Create and bind a server on port 3000. This way
    // when Apostrophe starts up we are guaranteed it won't
    // randomly be assigned this port, nor be confused by
    // the falsiness of port 0 and use the default value.
    temporaryServer = require('http').createServer();
    temporaryServer.listen(3000).on('error', function() {
      // The port is likely already in use, which is
      // good enough for us, no need to raise an error.
    });
  });

  after(function(done) {
    return t.destroy(apos, function() {
      if (temporaryServer.listening) {
        temporaryServer.close(done);
      } else {
        done();
      }
    });
  });

  it('express should exist on the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 0
        }
      },
      afterInit: function(callback) {
        assert(apos.express);
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  it('should bind the server to a random port when given port 0', function(done) {
    var server = apos.modules['apostrophe-express'].server;
    assert(server.address().port !== 3000);
    done();
  });

});
