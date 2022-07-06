const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Caches', function() {

  after(async function() {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  let apos;
  it('should exist on the apos object', async function() {
    apos = await t.create({
      root: module
    });
    assert(apos.cache);
  });
  it('should not contain capuchin yet', async function() {
    assert(!(await apos.cache.get('test', 'capuchin')));
  });
  it('should allow us to store capuchin', async function() {
    await apos.cache.set('test', 'capuchin', { message: 'eek eek' });
  });
  it('second cache can contain capuchin with a different value', async function() {
    await apos.cache.set('test2', 'capuchin', { message: 'ook ook' });
    assert.strictEqual((await apos.cache.get('test', 'capuchin')).message, 'eek eek');
    assert.strictEqual((await apos.cache.get('test2', 'capuchin')).message, 'ook ook');
  });
  it('should now contain capuchin', async function() {
    const monkey = await apos.cache.get('test', 'capuchin');
    assert(monkey);
    assert(monkey.message === 'eek eek');
  });
  it('should not crash on clear #2', async function() {
    await apos.cache.clear('test');
  });
  it('should not contain capuchin anymore', async function() {
    assert(!(await apos.cache.get('test', 'capuchin')));
  });
  it('but test2 cache still does contain capuchin', async function() {
    assert.strictEqual((await apos.cache.get('test2', 'capuchin')).message, 'ook ook');
  });
  it('unique key index does block double insert in same namespace', async function() {
    try {
      await apos.cache.cacheCollection.insert({
        name: 'test2',
        key: 'capuchin'
      });
      // That's bad, we should be blocked
      assert(false);
    } catch (e) {
      // That's good, we were blocked
    }
  });
});
