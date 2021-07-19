const fs = require('fs-extra');
const path = require('path');
const { stripIndent } = require('common-tags');
const assert = require('assert');
const t = require('../test-lib/test.js');

describe('Bundle', function() {

  this.timeout(t.timeout);

  before(() => {
    // bundles work only in node_modules, symlink our test bundle
    if (!fs.existsSync(path.join(__dirname, '/node_modules/test-bundle'))) {
      fs.symlinkSync(path.join(__dirname, '/test-bundle'), path.join(__dirname, '/node_modules/test-bundle'), 'dir');
    }
    // Simulate presence of a transitive dependency (a dependency of a
    // dependency) in node_modules that has the same name as a project level
    // module. This can happen due to npm/yarn flattening.
    const same = path.join(__dirname, '/node_modules/same-name-as-transitive-dependency');
    fs.removeSync(same);
    fs.mkdirSync(same);
    fs.writeFileSync(path.join(same, 'index.js'), stripIndent`
      module.exports = {
        init(self) {
          throw new Error('transitive dependency loaded as apostrophe package');
        }
      }
    `);
  });

  it('should support bundle', async function() {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          'test-bundle': {},
          'test-bundle-sub': {}
        }
      });
      assert(apos.test && apos.test.color === 'red');
      assert(apos.subtest && apos.subtest.color === 'red');
    } finally {
      if (apos) {
        await apos.destroy();
      }
    }
  });

  it('should ignore transitive dependencies even when present in node_modules due to flattening', async function() {
    let apos;
    try {
      apos = await t.create({
        root: module,
        modules: {
          'same-name-as-transitive-dependency': {}
        }
      });
      assert(apos.same && apos.same.color === 'purple');
    } finally {
      if (apos) {
        await apos.destroy();
      }
    }
  });
});
