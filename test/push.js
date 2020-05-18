const t = require('../test-lib/test.js');
const assert = require('assert');

let apos;

describe('Templates', function() {

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  it('should have a push property', async function() {
    apos = await t.create({
      root: module
    });

    assert(apos.push.__meta.name === '@apostrophecms/push');
  });

  it('should be able to push a browser call and get back an HTML-safe JSON string', function() {
    const req = apos.tasks.getAnonReq();
    req.browserCall('test(?)', {
      data: '<script>alert(\'ruh roh\');</script>'
    });

    const calls = req.getBrowserCalls();
    assert(calls.indexOf('<\\/script>') !== -1);
    assert(calls.indexOf('</script>') === -1);
  });
});
