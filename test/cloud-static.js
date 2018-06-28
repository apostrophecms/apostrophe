var t = require('../test-lib/test.js');
var assert = require('assert');
var fs = require('fs');
var request = require('request-promise');
var base;
var baseUrl;

describe('cloud-static', function() {

  after(function(done) {
    return t.destroy(apos, done);
  });

  this.timeout(t.timeout);

  var apos;

  it('should exist on the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          port: 7901
        }
      },

      afterInit: function(callback) {
        assert(apos.cloudStatic);
        apos.argv._ = [];
        return callback(null);
      },

      afterListen: function(err) {
        assert(!err);
        return done();
      }
    });
  });

  it('should accept sync up of a folder', function() {
    base = apos.rootDir + '/data/cloud-static-test-' + apos.pid;
    fs.mkdirSync(base);
    fs.writeFileSync(base + '/hello.txt', 'hello');
    fs.writeFileSync(base + '/goodbye.txt', 'goodbye');
    fs.mkdirSync(base + '/subdir');
    fs.writeFileSync(base + '/subdir/nested.txt', 'nested');
    return apos.cloudStatic.syncFolder(base, '/cloud-static-test-' + apos.pid);
  });

  it('should have the expected files after sync up', function() {
    baseUrl = 'http://localhost:7901/uploads/cloud-static-test-' + apos.pid;
    return request(baseUrl + '/hello.txt').then(function(data) {
      assert(data === 'hello');
    }).then(function() {
      return request(baseUrl + '/goodbye.txt').then(function(data) {
        assert(data === 'goodbye');
      });
    }).then(function() {
      return request(baseUrl + '/subdir/nested.txt').then(function(data) {
        assert(data === 'nested');
      });
    });
  });

  it('should accept update of a folder', function() {
    base = apos.rootDir + '/data/cloud-static-test-' + apos.pid;
    fs.mkdirSync(base);
    fs.rmdirSync(base + '/goodbye.txt');
    fs.writeFileSync(base + '/hello.txt', 'hello2');
    return apos.cloudStatic.syncFolder(base, 'cloud-static-test-' + apos.pid);
  });

  it('should have the expected files, and only those, after update', function() {
    baseUrl = 'http://localhost:7901/uploads/cloud-static-test-' + apos.pid;
    return request(baseUrl + '/hello.txt').then(function(data) {
      assert(data === 'hello2');
    }).then(function() {
      return request(baseUrl + '/goodbye.txt').then(function(data) {
        assert(false);
      }).catch(function() {
        assert(true);
      });
    }).then(function() {
      return request(baseUrl + '/subdir/nested.txt').then(function(data) {
        assert(data === 'nested');
      });
    });
  });

  it('should remove the folder contents without error', function() {
    return apos.cloudStatic.removeFolder('/cloud-static-test-' + apos.pid);
  });

  it('folder contents should be gone now', function() {
    return Promise.try(function() {
      request(baseUrl + '/hello.txt').then(function(data) {
        assert(false);
      }).catch(function() {
        assert(true);
      });
    }).then(function() {
      request(baseUrl + '/goodbye.txt').then(function(data) {
        assert(false);
      }).catch(function() {
        assert(true);
      });
    }).then(function() {
      request(baseUrl + '/subdir/nested.txt').then(function(data) {
        assert(false);
      }).catch(function() {
        assert(true);
      });
    });
  });

});
