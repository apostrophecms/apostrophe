const t = require('../test-lib/test.js');
const assert = require('assert');
const Promise = require('bluebird');

let apos;

describe('Locks', function() {

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  it('should be a property of the apos object', async function() {
    this.timeout(t.timeout);
    this.slow(2000);

    apos = await t.create({
      root: module,
      modules: {
        // Make some subclasses of the locks module. NORMALLY A BAD IDEA. But
        // we're doing it to deliberately force them to contend with each other,
        // rather than just throwing an error saying "hey you have this lock
        // now"
        '@apostrophecms/lock-1': {
          extend: '@apostrophecms/lock',
          options: {
            alias: 'locks1'
          }
        },
        '@apostrophecms/lock-2': {
          extend: '@apostrophecms/lock',
          options: {
            alias: 'locks2'
          }
        },
        '@apostrophecms/lock-3': {
          extend: '@apostrophecms/lock',
          options: {
            alias: 'locks3'
          }
        }
      }
    });

    assert(apos.modules['@apostrophecms/lock']);
    assert(apos.modules['@apostrophecms/lock-1']);
    assert(apos.modules['@apostrophecms/lock-2']);
    assert(apos.modules['@apostrophecms/lock-3']);
  });

  it('cleanup', async function() {
    await apos.lock.db.deleteMany({});
  });

  it('should allow a single lock without contention uneventfully', async function() {
    await apos.lock.lock('test');
    await apos.lock.unlock('test');
  });

  it('should allow two differently-named locks uneventfully', async function() {
    await apos.lock.lock('test1');
    await apos.lock.lock('test2');
    await apos.lock.unlock('test1');
    await apos.lock.unlock('test2');
  });

  it('should flunk a second lock by the same module with waitForSelf: false', async function() {
    await apos.lock.lock('test');

    try {
      await apos.lock.lock('test', { waitForSelf: false });
      assert(false);
    } catch (e) {
      assert(e);
    }

    await apos.lock.unlock('test');

    try {
      await apos.lock.unlock('test');
      assert(false);
    } catch (e) {
      assert(e);
    }
  });

  it('four parallel lock calls via the different modules should all succeed but not simultaneously', async function() {
    const one = apos.modules['@apostrophecms/lock'];
    const two = apos.modules['@apostrophecms/lock-1'];
    const three = apos.modules['@apostrophecms/lock-2'];
    const four = apos.modules['@apostrophecms/lock-3'];

    let active = 0;
    let successful = 0;

    await Promise.all([
      attempt(one),
      attempt(two),
      attempt(three),
      attempt(four)
    ]);

    assert(successful === 4);

    async function attempt(locks) {
      await apos.lock.lock('test');

      active++;
      assert(active === 1);
      return release();

      async function release() {
        // We have to decrement this before we start the call to
        // apos.lock.unlock because otherwise the callback for one of our
        // peers' insert attempts may succeed before the callback for
        // remove, leading to a false positive for test failure. -Tom
        active--;

        await Promise.delay(75 + Math.random() * 50);

        await apos.lock.unlock('test');

        successful++;

        return null;
      }
    }
  });

  it('four parallel lock calls via the different modules should all succeed but not simultaneously, even when the idleTimeout is short', async function() {
    const one = apos.modules['@apostrophecms/lock'];
    const two = apos.modules['@apostrophecms/lock-1'];
    const three = apos.modules['@apostrophecms/lock-2'];
    const four = apos.modules['@apostrophecms/lock-3'];

    let active = 0;
    let successful = 0;

    await Promise.all([
      attempt(one),
      attempt(two),
      attempt(three),
      attempt(four)
    ]);

    assert(successful === 4);

    async function attempt(locks) {
      await apos.lock.lock('test', { idleTimeout: 50 });

      active++;
      assert(active === 1);

      await release();

      async function release() {
        // We have to decrement this before we start the call to
        // apos.lock.unlock because otherwise the callback for one of our
        // peers' insert attempts may succeed before the callback for
        // remove, leading to a false positive for test failure. -Tom
        active--;
        await Promise.delay(75 + Math.random() * 50);
        await apos.lock.unlock('test');

        successful++;

        return null;
      }
    }
  });

  it('withLock method should run a function inside a lock', async function() {
    const result = await apos.lock.withLock('test-lock', async () => {
      await Promise.delay(50);

      return 'result';
    });

    assert(result === 'result');
  });

  it('withLock method should be able to run again (lock released)', async function() {
    const result = await apos.lock.withLock('test-lock', async () => {
      await Promise.delay(50);
      return 'result';
    });

    assert(result === 'result');
  });

  it('withLock method should hold the lock (cannot relock within fn)', async function() {

    return apos.lock.withLock('test-lock', async () => {
      await Promise.delay(50);

      try {
        await apos.lock.lock('test-lock', { waitForSelf: false });
        assert(false);
      } catch (e) {
        assert(e);
      }
    });
  });

  it('Second lock should wait for release of first one', async () => {
    let timedOut = false;
    await apos.lock.lock('test-lock');
    setTimeout(async () => {
      await apos.lock.unlock('test-lock');
      timedOut = true;
    });
    await apos.lock.lock('test-lock');
    assert(timedOut);
    await apos.lock.unlock('test-lock');
  });

});
