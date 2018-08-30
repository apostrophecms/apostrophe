var t = require('../test-lib/test.js');
var assert = require('assert');
var apos;
var request = require('request-promise');
var _ = require('lodash');
var Promise = require('bluebird');

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
        },
        'apostrophe-global': {
          whileBusyDelay: 0.5
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

  it('busy mechanism', function() {
    this.timeout(50000);
    var retrieved = false;
    return apos.global.whileBusy(function() {
      // Intentional parallelism: start a request while
      // we're busy, so we can verify it waits
      request('http://localhost:7900/').then(function(content) {
        // fn should complete before this is retrieved
        assert(content.indexOf('counts: 10') !== -1);
        retrieved = true;
      });
      return apos.docs.db.findOne({
        type: 'apostrophe-global'
      }).then(function(global) {
        assert(global.globalBusy);
      }).then(function() {
        return Promise.mapSeries(_.range(0, 10), function(i) {
          return apos.docs.db.update({
            type: 'apostrophe-global'
          }, {
            $inc: {
              counts: 1
            }
          }).then(function() {
            return Promise.delay(50);
          });
        }).then(function() {
          return apos.docs.db.findOne({
            type: 'apostrophe-global'
          });
        }).then(function(doc) {
          assert(doc.counts === 10);
        });
      }).then(function() {
        assert(!retrieved);
      });
    }).then(function() {
      // Wait up to 1 second more for the delayed request to succeed
      var start = Date.now();
      return check();
      function check() {
        if (retrieved) {
          return;
        }
        if (Date.now() - start > 1000) {
          assert(false);
        }
        return Promise.delay(50).then(check);
      }
    }).then(function() {
      // Now that we are no longer busy a new request should take less than a second
      return request('http://localhost:7900/').then(function(content) {
        assert(content.indexOf('counts: 10') !== -1);
      });
    }).then(function() {
      return apos.docs.db.findOne({
        type: 'apostrophe-global'
      });
    }).then(function(global) {
      assert(!global.globalBusy);
    });
  })

});
