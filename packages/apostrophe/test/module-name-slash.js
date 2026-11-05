const assert = require('node:assert/strict');
const t = require('../test-lib/test.js');

describe('Module names containing a slash', function() {

  let apos;

  this.timeout(t.timeout);

  afterEach(async function () {
    await t.destroy(apos);
    apos = null;
  });

  it('refuses to start with a slash in a module name that is not an npm namespace', async function() {
    await assert.rejects(
      async () => {
        apos = await t.create({
          root: module,
          exit: 'throw',
          modules: {
            'nested/stuff': {}
          }
        });
      },
      error => {
        assert.match(error.message, /nested\/stuff/);
        assert.match(error.message, /nestedModuleSubdirs/);
        return true;
      }
    );
  });

  it('refuses a namespaced name with more than one slash', async function() {
    await assert.rejects(
      async () => {
        apos = await t.create({
          root: module,
          exit: 'throw',
          modules: {
            '@namespace/nested/stuff': {}
          }
        });
      },
      /@namespace\/nested\/stuff/
    );
  });

  it('still accepts npm-namespaced module names', async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/page': {}
      }
    });
    assert(apos.modules['@apostrophecms/page']);
  });
});
