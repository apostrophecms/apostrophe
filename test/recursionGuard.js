const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Utils', function() {

  this.timeout(t.timeout);

  let apos;

  after(() => {
    return t.destroy(apos);
  });

  it('should exist on the apos.util object', async () => {
    apos = await t.create({
      root: module
    });
    assert(apos.util.recursionGuard);
  });

  it('should create a stack as it goes and stop without executing depth 50', async () => {
    let depth = 0;
    let depth49First = true;
    const req = apos.task.getReq();
    const result = await load();
    // Guarded functions not directly blocked by the depth rule should
    // return their own result
    assert(result === 'result');
    assert(depth === 49);
    assert(!req.aposStack.length);
    async function load() {
      return apos.util.recursionGuard(req, 'test', async () => {
        depth++;
        assert(req.aposStack);
        assert(req.aposStack.length === depth);
        const nestedResult = await load();
        // Careful, "depth" stays at 49 as we return up the stack
        if ((depth === 49) && (depth49First === true)) {
          // Guarded functions directly blocked by the depth rule
          // should return undefined
          assert(nestedResult === undefined);
          depth49First = false;
        } else {
          // Other invocations should return the result of the inner function
          assert(nestedResult === 'result');
        }
        return 'result';
      });
    }
  });
});
