var t = require('../test-lib/test.js');
var assert = require('assert');
var apos;

describe('Global', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  it('global should exist on the apos object', function(done) {
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
        assert(apos.global);
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

  it('should populate when global.addGlobalToData is used as middleware', function(done) {
    var req = apos.tasks.getAnonReq();
    req.res.status = function(n) {
      assert(n <= 400);
      return req.res;
    };
    req.res.send = function(m) {};
    return apos.global.addGlobalToData(req, req.res, function() {
      assert(req.data.global);
      assert(req.data.global.type === 'apostrophe-global');
      done();
    });
  });

  it('should populate when global.addGlobalToData is used with a callback', function(done) {
    var req = apos.tasks.getAnonReq();
    return apos.global.addGlobalToData(req, function(err) {
      assert(!err);
      assert(req.data.global);
      assert(req.data.global.type === 'apostrophe-global');
      done();
    });
  });

  it('should populate when global.addGlobalToData is used to return a promise', function() {
    var req = apos.tasks.getAnonReq();
    return apos.global.addGlobalToData(req).then(function() {
      assert(req.data.global);
      assert(req.data.global.type === 'apostrophe-global');
    });
  });

});
