const assert = require('node:assert/strict');
const t = require('../test-lib/test.js');

// Collect everything written to stdout and stderr while fn runs
async function captureOutput(fn) {
  const chunks = [];
  const stdout = process.stdout.write;
  const stderr = process.stderr.write;
  process.stdout.write = (chunk, ...rest) => {
    chunks.push(String(chunk));
    return stdout.call(process.stdout, chunk, ...rest);
  };
  process.stderr.write = (chunk, ...rest) => {
    chunks.push(String(chunk));
    return stderr.call(process.stderr, chunk, ...rest);
  };
  try {
    const result = await fn();
    return {
      result,
      output: chunks.join('')
    };
  } finally {
    process.stdout.write = stdout;
    process.stderr.write = stderr;
  }
}

describe('Module names containing a slash', function() {

  let apos;

  this.timeout(t.timeout);

  afterEach(async function () {
    await t.destroy(apos);
    apos = null;
  });

  it('still loads a module whose name contains a slash, with a warning recommending nestedModuleSubdirs', async function() {
    const { result, output } = await captureOutput(() => t.create({
      root: module,
      modules: {
        'slashed/stuff': {}
      }
    }));
    apos = result;
    assert.equal(apos.modules['slashed/stuff'].loaded, true);
    assert.match(output, /module-name-slashes/);
    assert.match(output, /slashed\/stuff/);
    assert.match(output, /nestedModuleSubdirs/);
    // The parent folder is part of the module name, not an unused module
    assert.doesNotMatch(output, /modules\/slashed folder, but that module is not activated/);
  });

  it('does not warn about npm-namespaced module names', async function() {
    const { result, output } = await captureOutput(() => t.create({
      root: module,
      modules: {
        '@apostrophecms/page': {}
      }
    }));
    apos = result;
    assert(apos.modules['@apostrophecms/page']);
    assert.doesNotMatch(output, /module-name-slashes/);
  });
});
