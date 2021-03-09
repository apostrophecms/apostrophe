const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

describe('Global', function() {

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  it('global should exist on the apos object', async function() {
    apos = await t.create({
      root: module,
      modules: {
        'global-tests': {
          apiRoutes(self) {
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
    return apos.doc.db.updateOne({
      slug: 'global',
      aposLocale: 'en:published'
    }, {
      $set: {
        test: 'test'
      }
    });
  });

  it('should populate when global.addGlobalToData is awaited', async function() {
    const req = apos.task.getAnonReq();
    await apos.global.addGlobalToData(req);
    assert(req.data.global);
    assert(req.data.global.type === '@apostrophecms/global');
    assert(req.data.global.test === 'test');
  });

  it('should populate via middleware', async function() {
    const body = await apos.http.get('/api/v1/global-tests/test');
    assert(body === 'test');
  });

});
