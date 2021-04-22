const t = require('../test-lib/test.js');
const assert = require('assert');

let apos;

describe('Middleware and Route Order', function() {

  this.timeout(t.timeout);

  after(async function () {
    return t.destroy(apos);
  });

  it('should stand up', async () => {
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
  it('should hit all middleware in thirdRouteA', async () => {
    const result = await apos.http.get('/api/v1/third/third-route-a');
    assert(result.firstMiddlewareRan);
    assert(result.secondMiddlewareRan);
    assert(result.thirdMiddlewareRan);
  });
  it('should hit only the first middleware in thirdRouteB', async () => {
    const result = await apos.http.get('/api/v1/third/third-route-b');
    assert(result.firstMiddlewareRan);
    assert(!result.secondMiddlewareRan);
    assert(!result.thirdMiddlewareRan);
  });
});
