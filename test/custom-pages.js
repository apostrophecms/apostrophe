let t = require('../test-lib/test.js');
let assert = require('assert');
let request = require('request');
let apos;

describe('custom-pages', function() {

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        'apostrophe-express': {
          secret: 'xxx'
        },
        'nifty-pages': {
          extend: 'apostrophe-custom-pages'
        }
      }
    });
  });

  it('should fire a dispatch route for its homepage', async function() {
    let niftyPages = apos.modules['nifty-pages'];
    await niftyPages.dispatch('/', niftyPages.indexPage);
    // Simulate a page request
    let req = {
      data: {
        bestPage: {
          type: 'nifty-page'
        }
      },
      remainder: '/'
    };
    niftyPages.on('apostrophe-pages:serve', 'dispatchNiftyPage', function() {
      assert(req.handlerInvoked);
    });
  });

  it('should fire a dispatch route matching a second, longer URL', async function() {
    let niftyPages = apos.modules['nifty-pages'];
    await niftyPages.dispatch('/foo', function(req) {
      req.fooInvoked = true;
    });
    // Simulate a page request
    let req = {
      data: {
        bestPage: {
          type: 'nifty-page'
        }
      },
      remainder: '/foo'
    };
    niftyPages.on('apostrophe-pages:serve', 'dispatchNiftyFooPage', function() {
      assert(req.fooInvoked);
    });
  });

  it('should fire a dispatch route with parameters', async function() {
    let niftyPages = apos.modules['nifty-pages'];
    await niftyPages.dispatch('/bar/:bizzle/:kapow/*', function(req) {
      req.barInvoked = true;
    });
    // Simulate a page request
    let req = {
      data: {
        bestPage: {
          type: 'nifty-page'
        }
      },
      remainder: '/bar/wacky/wonky/wibble/skip'
    };
    niftyPages.on('apostrophe-pages:serve', 'dispatchNiftyBarPage', function() {
      assert(req.barInvoked);
      assert(req.params.bizzle === 'wacky');
      assert(req.params.kapow === 'wonky');
      assert(req.params[0] === 'wibble/skip');
    });
  });

  it('should allow a later call to dispatch to override an earlier dispatch route', async function() {
    let niftyPages = apos.modules['nifty-pages'];
    await niftyPages.dispatch('/foo', function(req) {
      req.foo2Invoked = true;
      req.template = function(req, args) {
        return 'niftyPages-foo';
      };
    });
    // Simulate a page request
    let req = {
      data: {
        bestPage: {
          type: 'nifty-page'
        }
      },
      remainder: '/foo'
    };
    niftyPages.on('apostrophe-pages:serve', 'dispatchNiftyFooPageOverride', function() {
      assert(req.foo2Invoked);
      assert(!req.fooInvoked);
    });
  });

  it('should not match when page type is wrong', function() {
    let niftyPages = apos.modules['nifty-pages'];
    // Simulate a page request for the wrong page type
    let req = {
      data: {
        bestPage: {
          type: 'wibble-page'
        }
      },
      remainder: '/foo'
    };
    niftyPages.on('apostrophe-pages:serve', 'dispatchNiftyFooPageWrongType', function() {
      assert(!req.foo2Invoked);
    });
  });

  it('should not match when there is no bestPage', function() {
    let niftyPages = apos.modules['nifty-pages'];
    // Simulate a page request for the wrong page type
    let req = {
      data: {
        bestPage: null
      },
      remainder: '/foo'
    };
    niftyPages.on('apostrophe-pages:serve', 'dispatchNiftyFooPageNoBest', function() {
      assert(!req.foo2Invoked);
    });
  });

  it('should be able to insert a test page manually into the db', async function() {
    let testItem =
      { _id: 'niftyPages1',
        type: 'nifty-page',
        slug: '/niftyPages',
        published: true,
        path: '/niftyPages',
        level: 1,
        rank: 5
      };
    await apos.docs.db.insert(testItem);
  });

  it('should match a dispatch route on a real live page request', function() {
    return request('http://localhost:3000/niftyPages', function(err, response, body) {
      console.error(err);
      console.error(body);
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Did we get the index output?
      assert(body.match(/niftyPages-index/));
    });
  });

  it('runs foo route with /foo remainder', function() {
    return request('http://localhost:3000/niftyPages/foo', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 200);
      // Did we get the index output?
      assert(body.match(/niftyPages-foo/));
    });
  });

  it('yields 404 with bad remainder (not matching any dispatch routes)', function() {
    return request('http://localhost:3000/niftyPages/tututu', function(err, response, body) {
      assert(!err);
      // Is our status code good?
      assert.equal(response.statusCode, 404);
    });
  });

});
