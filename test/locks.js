const t = require('../test-lib/test.js');
const assert = require('assert');
const async = require('async');
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

    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        'apostrophe-express': {
          port: 7900,
          address: 'localhost',
          session: {
            secret: 'Vulputate'
          }
        },
        // Make some subclasses of the locks module. NORMALLY A BAD IDEA. But
        // we're doing it to deliberately force them to contend with each other,
        // rather than just throwing an error saying "hey you have this lock
        // now"
        'apostrophe-locks-1': {
          extend: 'apostrophe-locks',
          alias: 'locks1'
        },
        'apostrophe-locks-2': {
          extend: 'apostrophe-locks',
          alias: 'locks2'
        },
        'apostrophe-locks-3': {
          extend: 'apostrophe-locks',
          alias: 'locks3'
        }
      }
    });

    assert(apos.modules['apostrophe-locks']);
    assert(apos.modules['apostrophe-locks-1']);
    assert(apos.modules['apostrophe-locks-2']);
    assert(apos.modules['apostrophe-locks-3']);
  });

  it('cleanup', async function() {
    try {
      const response = await apos.locks.db.remove({});

      assert(response.result.ok === 1);
    } catch (e) {
      assert(false);
    }
  });

  it('should allow a single lock without contention uneventfully', async function() {
    const locks = apos.modules['apostrophe-locks'];

    try {
      await locks.lock('test');

      await locks.unlock('test');
    } catch (e) {
      assert(false);
    }

    // function lock(callback) {
    //   return locks.lock('test', callback);
    // }
    // function unlock(callback) {
    //   return locks.unlock('test', callback);
    // }
  });

  it('should allow two differently-named locks uneventfully', async function() {
    const locks = apos.modules['apostrophe-locks'];

    try {
      await locks.lock('test1');
      await locks.unlock('test1');
      await locks.lock('test2');
      await locks.unlock('test2');
    } catch (e) {
      assert(false);
    }
  });

  it('should flunk a second lock by the same module', async function() {
    const locks = apos.modules['apostrophe-locks'];

    await locks.lock('test');

    try {
      await locks.lock('test');
    } catch (e) {
      assert(e);
    }

    await locks.unlock('test');

    try {
      await locks.unlock('test');
    } catch (e) {
      assert(e);
    }
  });

  it('four parallel lock calls via the different modules should all succeed but not simultaneously', async function() {
    const one = apos.modules['apostrophe-locks'];
    const two = apos.modules['apostrophe-locks-1'];
    const three = apos.modules['apostrophe-locks-2'];
    const four = apos.modules['apostrophe-locks-3'];

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
      await locks.lock('test');

      active++;
      assert(active === 1);
      return release();

      async function release() {
        // We have to decrement this before we start the call to
        // locks.unlock because otherwise the callback for one of our
        // peers' insert attempts may succeed before the callback for
        // remove, leading to a false positive for test failure. -Tom
        active--;

        await Promise.delay(75 + Math.random() * 50);

        await locks.unlock('test');

        successful++;

        return null;
      }
    }
  });

  it('four parallel lock calls via the different modules should all succeed but not simultaneously, even when the idleTimeout is short', async function() {
    const one = apos.modules['apostrophe-locks'];
    const two = apos.modules['apostrophe-locks-1'];
    const three = apos.modules['apostrophe-locks-2'];
    const four = apos.modules['apostrophe-locks-3'];

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
      await locks.lock('test', { idleTimeout: 50 });

      active++;
      assert(active === 1);

      await release();

      async function release() {
        // We have to decrement this before we start the call to
        // locks.unlock because otherwise the callback for one of our
        // peers' insert attempts may succeed before the callback for
        // remove, leading to a false positive for test failure. -Tom
        active--;
        await Promise.delay(75 + Math.random() * 50);
        await locks.unlock('test');

        successful++;

        return null;
      }
    }
  });

  // it('with promises: should flunk a second lock by the same module', function() {
  //   const locks = apos.modules['apostrophe-locks'];
  //   return Promise.try(function() {
  //     return locks.lock('test');
  //   }).then(function() {
  //     return locks.lock('test')
  //       .catch(function(err) {
  //         // SHOULD fail
  //         assert(err);
  //       });
  //   }).then(function() {
  //     return locks.unlock('test');
  //   }).then(function() {
  //     return locks.unlock('test')
  //       .catch(function(err) {
  //         // SHOULD fail
  //         assert(err);
  //       });
  //   });
  // });

  // it('withLock method should run a function inside a lock', function() {
  //   const locks = apos.modules['apostrophe-locks'];
  //   return locks.withLock('test-lock', function() {
  //     return Promise.delay(50).then(function() {
  //       return 'result';
  //     });
  //   }).then(function(result) {
  //     assert(result === 'result');
  //   });
  // });

  // it('withLock method should be able to run again (lock released)', function() {
  //   const locks = apos.modules['apostrophe-locks'];
  //   return locks.withLock('test-lock', function() {
  //     return Promise.delay(50).then(function() {
  //       return 'result';
  //     });
  //   }).then(function(result) {
  //     assert(result === 'result');
  //   });
  // });

  // it('withLock method should hold the lock (cannot relock within fn)', function() {
  //   const locks = apos.modules['apostrophe-locks'];
  //   return locks.withLock('test-lock', function() {
  //     return Promise.delay(50).then(function() {
  //       return locks.lock('test-lock').then(function() {
  //         assert(false);
  //       }).catch(function(e) {
  //         assert(e);
  //       });
  //     });
  //   });
  // });

  // it('callbacks: withLock method should run a function inside a lock', function(done) {
  //   const locks = apos.modules['apostrophe-locks'];
  //   return locks.withLock('test-lock', function(callback) {
  //     return setTimeout(function() {
  //       return callback(null, 'result');
  //     }, 50);
  //   }, function(err, result) {
  //     assert(!err);
  //     assert(result === 'result');
  //     done();
  //   });
  // });

});
