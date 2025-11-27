import { strict as assert } from 'node:assert';
import path from 'node:path';
import url from 'node:url';
import util from 'node:util';
import { exec } from 'node:child_process';
import t from '../../test-lib/test.js';
import app from './app.js';

describe('Apostrophe ESM', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    await util.promisify(exec)('npm install', { cwd: path.resolve(process.cwd(), 'test/esm-project') });

    apos = await t.create({
      ...app,
      root: import.meta
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
        filename: url.fileURLToPath(import.meta.url),
        import: actual.root.import.toString(),
        require: actual.root.require.toString()
      },
      rootDir: path.dirname(url.fileURLToPath(import.meta.url)),
      npmRootDir: path.dirname(url.fileURLToPath(import.meta.url))
    };

    assert.deepEqual(actual, expected);
  });
});
