const t = require('../test-lib/test.js');
const assert = require('assert');
const request = require('request-promise');
let apos;

describe('Global', function() {

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  it('global should exist on the apos object', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        '@apostrophecms/express': {
          options: {
            secret: 'xxx',
            port: 7900
          }
        },
        'global-tests': {
          apiRoutes(self, options) {
            return {
              get: {
                test(req) {
                  return req.data.global.test;
                }
              }
            };
          }
        }
      }
    });
  });

  it('should be able to add a test property', async function() {
    return apos.docs.db.updateOne({
      slug: 'global'
    }, {
      $set: {
        test: 'test'
      }
    });
  });

  it('should populate when global.addGlobalToData is awaited', async function() {
    let req = apos.tasks.getAnonReq();
    await apos.global.addGlobalToData(req);
    assert(req.data.global);
    assert(req.data.global.type === '@apostrophecms/global');
    assert(req.data.global.test === 'test');
  });

  it('should populate via middleware', async function() {
    const body = await request('http://localhost:7900/api/v1/global-tests/test');
    assert(body === 'test');
  });

});
