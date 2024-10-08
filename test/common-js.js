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
        ...apos.root,
        filename: apos.root.filename,
        import: apos.root.import.toString(),
        require: apos.root.require.toString()
      },
      rootDir: apos.rootDir,
      npmRootDir: apos.npmRootDir
    };
    const expected = {
      root: {
        filename: module.filename,
        import: actual.root.import.toString(),
        require: actual.root.require.toString()
      },
      rootDir: __dirname,
      npmRootDir: __dirname
    };

    assert.deepEqual(actual, expected);
  });
});
