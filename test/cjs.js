const { strict: assert } = require('node:assert');
const path = require('node:path');
const url = require('node:url');
const t = require('../test-lib/test.js');

describe('Apostrophe CJS', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
      }
    });
  });

  after(function() {
    return t.destroy(apos);
  });

  it('should have root, rootDir, npmRootDir', function() {
    const actual = {
      root: apos.root,
      rootDir: apos.rootDir,
      npmRootDir: apos.npmRootDir
    };
    const expected = {
      root: {
        filename: __filename,
        require: actual.root.require
      },
      rootDir: __dirname,
      npmRootDir: __dirname
    };

    assert.deepEqual(actual, expected);
  });
});
