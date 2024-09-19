const { strict: assert } = require('node:assert');
const t = require('../test-lib/test.js');

describe('Apostrophe CommonJS', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module
    });
  });

  after(function() {
    return t.destroy(apos);
  });

  it('should have root, rootDir, npmRootDir', function() {
    const actual = {
      root: {
        filename: apos.root.filename,
        require: apos.root.require.toString()
      },
      rootDir: apos.rootDir,
      npmRootDir: apos.npmRootDir
    };
    const expected = {
      root: {
        filename: module.filename,
        require: module.require.toString()
      },
      rootDir: __dirname,
      npmRootDir: __dirname
    };

    assert.deepEqual(actual, expected);
  });
});
