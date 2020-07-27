let t = require('../test-lib/test.js');
let assert = require('assert');

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
});
