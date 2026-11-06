const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Middleware and Route Order', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function () {
    return t.destroy(apos);
  });

  it('should stand up', async function() {
    apos = await t.create({
      root: module,

      modules: {
        first: {
          middleware(self) {
            return {
              firstMiddleware(req, res, next) {
                req.firstMiddlewareRan = true;
                return next();
              }
            };
          }
        },
        second: {
          middleware(self) {
            return {
              secondMiddleware(req, res, next) {
                req.secondMiddlewareRan = true;
                return next();
              }
            };
          }
        },
        third: {
          middleware(self) {
            return {
              thirdMiddleware(req, res, next) {
                req.thirdMiddlewareRan = true;
                return next();
              }
            };
          },
          apiRoutes(self) {
            return {
              get: {
                thirdRouteA(req) {
                  return {
                    firstMiddlewareRan: req.firstMiddlewareRan,
                    secondMiddlewareRan: req.secondMiddlewareRan,
                    thirdMiddlewareRan: req.thirdMiddlewareRan
                  };
                },
                thirdRouteB: {
                  before: 'middleware:second',
                  route(req) {
                    return {
                      firstMiddlewareRan: req.firstMiddlewareRan,
                      secondMiddlewareRan: req.secondMiddlewareRan,
                      thirdMiddlewareRan: req.thirdMiddlewareRan
                    };
                  }
                }
              }
            };
          }
        }
      }
    });
  });
  it('should hit all middleware in thirdRouteA', async function() {
    const result = await apos.http.get('/api/v1/third/third-route-a');
    assert(result.firstMiddlewareRan);
    assert(result.secondMiddlewareRan);
    assert(result.thirdMiddlewareRan);
  });
  it('should hit only the first middleware in thirdRouteB', async function() {
    const result = await apos.http.get('/api/v1/third/third-route-b');
    assert(result.firstMiddlewareRan);
    assert(!result.secondMiddlewareRan);
    assert(!result.thirdMiddlewareRan);
  });
});

describe('Middleware "before" chains (#4060)', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function () {
    return t.destroy(apos);
  });

  it('resolves chained "before" options transitively', async function() {
    apos = await t.create({
      root: module,
      modules: {
        // Registered as c, b, a; b asks to run before c, and a before b
        'order-c': {
          middleware(self) {
            return {
              cMiddleware(req, res, next) {
                req.order = [ ...(req.order || []), 'c' ];
                return next();
              }
            };
          },
          apiRoutes(self) {
            return {
              get: {
                order(req) {
                  return { order: req.order || [] };
                }
              }
            };
          }
        },
        'order-b': {
          middleware(self) {
            return {
              bMiddleware: {
                before: 'order-c',
                middleware(req, res, next) {
                  req.order = [ ...(req.order || []), 'b' ];
                  return next();
                }
              }
            };
          }
        },
        'order-a': {
          middleware(self) {
            return {
              aMiddleware: {
                before: 'order-b',
                middleware(req, res, next) {
                  req.order = [ ...(req.order || []), 'a' ];
                  return next();
                }
              }
            };
          }
        }
      }
    });
    const result = await apos.http.get('/api/v1/order-c/order');
    assert.deepStrictEqual(result.order, [ 'a', 'b', 'c' ]);
  });
});
