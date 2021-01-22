const fs = require('fs');
const path = require('path');

const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

describe('Bundle', function() {

  this.timeout(t.timeout);

  before(() => {
    // bundles work only in node_modules, symlink our test bundle
    if (!fs.existsSync(path.join(__dirname, '/node_modules/test-bundle'))) {
      fs.symlinkSync(path.join(__dirname, '/test-bundle'), path.join(__dirname, '/node_modules/test-bundle'), 'dir');
    }
  });

  after(async function() {
    return t.destroy(apos);
  });

  it('should support bundle', async function() {
    apos = await t.create({
      root: module,
      modules: {
        'test-bundle': {},
        'test-bundle-sub': {}
      }
    });
    assert(apos.test && apos.test.color === 'red');
    assert(apos.subtest && apos.subtest.color === 'red');
  });
});
