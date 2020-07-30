const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

describe('page-type', function() {

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize', async function() {
    apos = await t.create({
      root: module,
      modules: {
        'nifty-page': {
          extend: '@apostrophecms/page-type'
        }
      }
    });

    assert(apos && apos.__meta.name === 'apostrophe');
  });

  it('should fire a dispatch route for its homepage', async function() {
    const niftyPages = apos.modules['nifty-page'];
    niftyPages.dispatch('/', async function(req) {
      req.handlerInvoked = true;
      niftyPages.setTemplate(req, 'index');
    });
    // Simulate a page request
    const req = apos.task.getAnonReq({
      data: {
        bestPage: {
          type: 'nifty-page'
        }
      },
      remainder: '/'
    });
    await apos.page.emit('serve', req);
    assert(req.handlerInvoked);
  });

  it('should fire a dispatch route matching a second, longer URL', async function() {
    const niftyPages = apos.modules['nifty-page'];
    niftyPages.dispatch('/foo', async function(req) {
      req.handlerInvoked = true;
      niftyPages.setTemplate(req, 'foo');
    });
    // Simulate a page request
    const req = apos.task.getAnonReq({
      data: {
        bestPage: {
          type: 'nifty-page'
        }
      },
      remainder: '/foo'
    });
    await apos.page.emit('serve', req);
    assert(req.handlerInvoked);
  });

  it('should fire a dispatch route with parameters', async function() {
    const niftyPages = apos.modules['nifty-page'];
    niftyPages.dispatch('/bar/:bizzle/:kapow/*', async function(req) {
      req.barInvoked = true;
      niftyPages.setTemplate(req, 'bar');
    });
    // Simulate a page request
    const req = apos.task.getAnonReq({
      data: {
        bestPage: {
          type: 'nifty-page'
        }
      },
      remainder: '/bar/wacky/wonky/wibble/skip'
    });
    await apos.page.emit('serve', req);
    assert(req.barInvoked);
    assert(req.params.bizzle === 'wacky');
    assert(req.params.kapow === 'wonky');
    assert(req.params[0] === 'wibble/skip');
  });

  it('should allow a later call to dispatch to override an earlier dispatch route', async function() {
    const niftyPages = apos.modules['nifty-page'];
    await niftyPages.dispatch('/foo', function(req) {
      req.foo2Invoked = true;
      niftyPages.setTemplate(req, 'foo2');
    });
    // Simulate a page request
    const req = apos.task.getAnonReq({
      data: {
        bestPage: {
          type: 'nifty-page'
        }
      },
      remainder: '/foo'
    });
    await apos.page.emit('serve', req);
    assert(req.foo2Invoked);
    assert(!req.fooInvoked);
  });

  it('should not match when page type is wrong', async function() {
    // Simulate a page request
    const req = apos.task.getAnonReq({
      data: {
        bestPage: {
          type: 'wibble-page'
        }
      },
      remainder: '/foo'
    });
    await apos.page.emit('serve', req);
    assert(!req.foo2Invoked);
  });

  it('should not match when there is no bestPage', async function() {
    // Simulate a page request
    const req = apos.task.getAnonReq({
      data: {
        bestPage: null
      },
      remainder: '/foo'
    });
    await apos.page.emit('serve', req);
    assert(!req.foo2Invoked);
  });

  it('should be able to insert a test page manually into the db', async function() {
    const testItem = {
      _id: 'niftyPages1',
      type: 'nifty-page',
      slug: '/niftyPages',
      published: true,
      path: '/niftyPages',
      level: 1,
      rank: 5,
      trash: false
    };

    const response = await apos.doc.db.insertOne(testItem);

    assert(response.insertedCount === 1);
    assert(response.ops[0]._id === 'niftyPages1');
  });

  it('should match a dispatch route on a real live page request', async function() {
    const body = await apos.http.get('/niftyPages');
    // Did we get the index output?
    assert(body.match(/niftyPages-index-template-rendered-this/));
  });

  it('runs foo route with /foo remainder', async function() {
    const body = await apos.http.get('/niftyPages/foo');
    // Did we get the foo output?
    assert(body.match(/niftyPages-foo2-template-rendered-this/));
  });

  it('yields 404 with bad remainder (not matching any dispatch routes)', async function() {
    try {
      await apos.http.get('/niftyPages/tututu');
      assert(false);
    } catch (e) {
      assert(e.status === 404);
    }
  });

});
