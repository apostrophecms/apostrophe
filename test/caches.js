let t = require('../test-lib/test.js');
let assert = require('assert');

describe('Caches', function() {

  after(async function() {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  let apos;
  let cache;
  it('should exist on the apos object', async function() {
    apos = await t.create({
      root: module
    });
    assert(apos.cache);
  });
  it('should give us a cache object', function() {
    cache = apos.cache.get('testMonkeys');
  });
  it('should not crash on clear', async function() {
    await cache.clear();
  });
  it('should not contain capuchin yet', async function() {
    assert(!(await cache.get('capuchin')));
  });
  it('should allow us to store capuchin', async function() {
    await cache.set('capuchin', { message: 'eek eek' });
  });
  it('should now contain capuchin', async function() {
    const monkey = await cache.get('capuchin');
    assert(monkey);
    assert(monkey.message === 'eek eek');
  });
  it('should not crash on clear #2', async function() {
    await cache.clear();
  });
  it('should not contain capuchin anymore', async function() {
    assert(!(await cache.get('capuchin')));
  });
});
