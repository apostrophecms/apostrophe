const assert = require('node:assert/strict');
const t = require('../test-lib/test.js');

describe('Modules Order', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function () {
    await t.destroy(apos);
    apos = null;
  });

  it('should sort modules based on their "before" property', async function() {
    apos = await t.create({
      root: module,
      modules: {
        // Before third, but also before first and schema (recursion)
        strange: {
          before: 'third',
          init() { }
        },
        // before schema
        first: {
          before: '@apostrophecms/schema',
          init() { }
        },
        // before schema, but after first (keep order)
        second: {
          before: '@apostrophecms/schema',
          init() { }
        },
        // before first, but also before schema (recursion)
        third: {
          before: 'first',
          init() { }
        },
        // before @apostrophecms/image (`before` in a module definition)
        'test-before': {},
        usual: {
          init() { }
        }
      }
    });

    const expected = [
      'strange',
      'third',
      'first',
      'second',
      '@apostrophecms/schema',
      'test-before',
      '@apostrophecms/image',
      'usual'
    ];
    const actual = Object.keys(apos.modules).filter(m => expected.includes(m));
    assert.deepEqual(actual, expected, 'modules are not sorted as expected');

    // We don't mess with the module owned context.
    assert.strictEqual(apos.modules.first.before, undefined);

    // Ensure we have the same number of modules when not reordering
    const expectedModuleCount = apos.modules.length;
    await t.destroy(apos);

    apos = await t.create({
      root: module,
      modules: {
        strange: {
          init() { }
        },
        first: {
          init() { }
        },
        second: {
          init() { }
        },
        third: {
          init() { }
        },
        'test-before': {
          before: null
        },
        usual: {
          init() { }
        }
      }
    });
    assert.strictEqual(apos.modules.length, expectedModuleCount, 'module count is not the same');

    {
      // ...and the natural order should be preserved
      const expected = [
        '@apostrophecms/schema',
        '@apostrophecms/image',
        'strange',
        'first',
        'second',
        'third',
        'test-before',
        'usual'
      ];
      const actual = Object.keys(apos.modules).filter(m => expected.includes(m));
      assert.deepEqual(actual, expected, 'modules are not matching the natural order');
    }
  });

  it('should handle circular "before" references', async function () {
    await t.destroy(apos);
    apos = await t.create({
      root: module,
      modules: {
        first: {
          before: 'second',
          init() { }
        },
        second: {
          before: 'first',
          init() { }
        }
      }
    });

    const expected = [
      'second',
      'first'
    ];
    const actual = Object.keys(apos.modules).filter(m => expected.includes(m));
    assert.deepEqual(actual, expected, 'modules are not sorted as expected');
  });
});
