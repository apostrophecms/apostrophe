const t = require('../test-lib/test.js');
const assert = require('assert');

describe('bootstrap of Apostrophe core', function() {

  this.timeout(t.timeout);

  // BOOTSTRAP FUNCTIONS ------------------------------------------- //

  it('should merge the options and local.js correctly', async function() {
    let apos;
    try {
      apos = await t.create({
        root: module,
        overrideTest: 'test' // overriden by data/local.js
      });
      assert(apos.options.overrideTest === 'foo');
    } finally {
      await t.destroy(apos);
    }
  });

  it('should accept a `__localPath` option and invoke local.js as a function if it is provided as one', async function() {
    let apos;
    try {
      apos = await t.create({
        root: module,
        overrideTest: 'test', // overriden by data/local_fn.js

        __localPath: '/data/local_fn.js'
      });
      assert(apos.options.overrideTest === 'foo');
    } finally {
      await t.destroy(apos);
    }
  });

  it('should invoke local.js as a function with the apos and config object', async function() {
    let apos;
    try {
      apos = await t.create({
        root: module,
        overrideTest: 'test', // concated in local_fn_b.js

        __localPath: '/data/local_fn_b.js'
      });
      assert(apos.options.overrideTest === 'test-foo');
    } finally {
      await t.destroy(apos);
    }
  });

});
