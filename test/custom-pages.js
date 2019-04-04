var t = require('../test-lib/test.js');
var assert = require('assert');
var request = require('request');

var apos;

describe('custom-pages', function() {

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

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900
        },
        'nifty-pages': {
          extend: 'apostrophe-custom-pages'
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

  it('should fire a dispatch route for its homepage', function(done) {
    var niftyPages = apos.modules['nifty-pages'];
    niftyPages.dispatch('/', function(req, callback) {
      req.handlerInvoked = true;
      req.template = function(req, args) {
        return 'niftyPages-index';
      };
      return setImmediate(callback);
    });
    // Simulate a page request
    var req = {
      data: {
        bestPage: {
          type: 'nifty-page'
        }
      },
      remainder: '/'
    };
    // pageServe method normally invoked via callAll in
    // the pages module
    niftyPages.pageServe(req, function(err) {
      assert(!err);
      assert(req.handlerInvoked);
      done();
    });
  });

  it('should fire a dispatch route matching a second, longer URL', function(done) {
    var niftyPages = apos.modules['nifty-pages'];
    niftyPages.dispatch('/foo', function(req, callback) {
      req.fooInvoked = true;
      return setImmediate(callback);
    });
    // Simulate a page request
    var req = {
      data: {
        bestPage: {
          type: 'nifty-page'
        }
      },
      remainder: '/foo'
    };
    // pageServe method normally invoked via callAll in
    // the pages module
    niftyPages.pageServe(req, function(err) {
      assert(!err);
      assert(req.fooInvoked);
      done();
    });
  });

  it('should fire a dispatch route with parameters', function(done) {
    var niftyPages = apos.modules['nifty-pages'];
    niftyPages.dispatch('/bar/:bizzle/:kapow/*', function(req, callback) {
      req.barInvoked = true;
      return setImmediate(callback);
    });
    // Simulate a page request
    var req = {
      data: {
        bestPage: {
          type: 'nifty-page'
        }
      },
      remainder: '/bar/wacky/wonky/wibble/skip'
    };
    // pageServe method normally invoked via callAll in
    // the pages module
    niftyPages.pageServe(req, function(err) {
      assert(!err);
      assert(req.barInvoked);
      assert(req.params.bizzle === 'wacky');
      assert(req.params.kapow === 'wonky');
      assert(req.params[0] === 'wibble/skip');
      done();
    });
  });

  it('should allow a later call to dispatch to override an earlier dispatch route', function(done) {
    var niftyPages = apos.modules['nifty-pages'];
    niftyPages.dispatch('/foo', function(req, callback) {
      req.foo2Invoked = true;
      req.template = function(req, args) {
        return 'niftyPages-foo';
      };
      return setImmediate(callback);
    });
    // Simulate a page request
    var req = {
      data: {
        bestPage: {
          type: 'nifty-page'
        }
      },
      remainder: '/foo'
    };
    // pageServe method normally invoked via callAll in
    // the pages module
    niftyPages.pageServe(req, function(err) {
      assert(!err);
      assert(req.foo2Invoked);
      assert(!req.fooInvoked);
      done();
    });
  });

  it('should not match when page type is wrong', function(done) {
    var niftyPages = apos.modules['nifty-pages'];
    // Simulate a page request for the wrong page type
    var req = {
      data: {
        bestPage: {
          type: 'wibble-page'
        }
      },
      remainder: '/foo'
    };
    // pageServe method normally invoked via callAll in
    // the pages module
    niftyPages.pageServe(req, function(err) {
      assert(!err);
      assert(!req.foo2Invoked);
      done();
    });
  });

  it('should not match when there is no bestPage', function(done) {
    var niftyPages = apos.modules['nifty-pages'];
    // Simulate a page request for the wrong page type
    var req = {
      data: {
        bestPage: null
      },
      remainder: '/foo'
    };
    // pageServe method normally invoked via callAll in
    // the pages module
    niftyPages.pageServe(req, function(err) {
      assert(!err);
      assert(!req.foo2Invoked);
      done();
    });
  });

  it('should be able to insert a test page manually into the db', function(done) {
    var testItem =
      { _id: 'niftyPages1',
        type: 'nifty-page',
        slug: '/niftyPages',
        published: true,
        path: '/niftyPages',
        level: 1,
        rank: 5
      };
    return apos.docs.db.insert(testItem, done);
  });

  it('should match a dispatch route on a real live page request', function(done) {
    return request('http://localhost:7900/niftyPages', function(err, response, body) {
      console.error(err);
      console.error(body);
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Did we get the index output?
      assert(body.match(/niftyPages-index/));
      return done();
    });
  });

  it('runs foo route with /foo remainder', function(done) {
    return request('http://localhost:7900/niftyPages/foo', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Did we get the index output?
      assert(body.match(/niftyPages-foo/));
      return done();
    });
  });

  it('yields 404 with bad remainder (not matching any dispatch routes)', function(done) {
    return request('http://localhost:7900/niftyPages/tututu', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 404);
      return done();
    });
  });

});
