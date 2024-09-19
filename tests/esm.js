import { strict as assert } from 'node:assert';
import path from 'node:path';
import url from 'node:url';
import t from '../test-lib/test.js';

describe('Apostrophe ESM', function() {
  t.setupPackages('tests');
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: import.meta,
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
        filename: url.fileURLToPath(import.meta.url),
        require: actual.root.require
      },
      rootDir: path.dirname(url.fileURLToPath(import.meta.url)),
      npmRootDir: path.dirname(url.fileURLToPath(import.meta.url))
    };

    assert.deepEqual(actual, expected);
  });
});
