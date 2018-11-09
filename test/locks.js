var t = require('../test-lib/test.js');
var assert = require('assert');
var async = require('async');
var Promise = require('bluebird');
var _ = require('@sailshq/lodash');
var apos;

describe('Locks', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  it('should be a property of the apos object', function(done) {
    this.timeout(t.timeout);
    this.slow(2000);

    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      modules: {
        'apostrophe-express': {
          port: 7900
        },
        // Make some subclasses of the locks module. NORMALLY A BAD IDEA. But
        // we're doing it to deliberately force them to contend with each other,
        // rather than just throwing an error saying "hey you have this lock now"
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
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-locks']);
        assert(apos.modules['apostrophe-locks-1']);
        assert(apos.modules['apostrophe-locks-2']);
        assert(apos.modules['apostrophe-locks-3']);

        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  it('cleanup', function(done) {
    apos.locks.db.remove({}, function(err) {
      assert(!err);
      done();
    });
  });

  it('should allow a single lock without contention uneventfully', function(done) {
    var locks = apos.modules['apostrophe-locks'];
    return async.series([ lock, unlock ], function(err) {
      assert(!err);
      done();
    });
    function lock(callback) {
      return locks.lock('test', callback);
    }
    function unlock(callback) {
      return locks.unlock('test', callback);
    }
  });

  it('should allow two differently-named locks uneventfully', function(done) {
    var locks = apos.modules['apostrophe-locks'];
    return async.series([ lock1, lock2, unlock1, unlock2 ], function(err) {
      assert(!err);
      done();
    });
    function lock1(callback) {
      return locks.lock('test1', callback);
    }
    function unlock1(callback) {
      return locks.unlock('test1', callback);
    }
    function lock2(callback) {
      return locks.lock('test2', callback);
    }
    function unlock2(callback) {
      return locks.unlock('test2', callback);
    }
  });

  it('should flunk a second lock by the same module', function(done) {
    var locks = apos.modules['apostrophe-locks'];
    return async.series([ lock, lockAgain, unlock, unlockAgain ], function(err) {
      assert(!err);
      done();
    });
    function lock(callback) {
      return locks.lock('test', callback);
    }
    function lockAgain(callback) {
      return locks.lock('test', function(err) {
        // SHOULD fail
        assert(err);
        return callback(null);
      });
    }
    function unlock(callback) {
      return locks.unlock('test', callback);
    }
    function unlockAgain(callback) {
      return locks.unlock('test', function(err) {
        // SHOULD fail
        assert(err);
        return callback(null);
      });
    }
  });

  it('four parallel lock calls via the different modules should all succeed but not simultaneously', function(done) {
    var one = apos.modules['apostrophe-locks'];
    var two = apos.modules['apostrophe-locks-1'];
    var three = apos.modules['apostrophe-locks-2'];
    var four = apos.modules['apostrophe-locks-3'];
    var active = 0;
    var successful = 0;
    attempt(one);
    attempt(two);
    attempt(three);
    attempt(four);
    function attempt(locks) {
      return locks.lock('test', function(err) {
        assert(!err);
        active++;
        assert(active === 1);
        setTimeout(release, 75 + Math.random() * 50);
      });
      function release() {
        // We have to decrement this before we start the call to
        // locks.unlock because otherwise the callback for one of our
        // peers' insert attempts may succeed before the callback for
        // remove, leading to a false positive for test failure. -Tom
        active--;
        return locks.unlock('test', function(err) {
          assert(!err);
          successful++;
          if (successful === 4) {
            done();
          }
        });
      }
    }
  });
  it('four parallel lock calls via the different modules should all succeed but not simultaneously, even when the idleTimeout is short', function(done) {
    var one = apos.modules['apostrophe-locks'];
    var two = apos.modules['apostrophe-locks-1'];
    var three = apos.modules['apostrophe-locks-2'];
    var four = apos.modules['apostrophe-locks-3'];
    var active = 0;
    var successful = 0;
    attempt(one);
    attempt(two);
    attempt(three);
    attempt(four);
    function attempt(locks) {
      return locks.lock('test', { idleTimeout: 50 }, function(err) {
        assert(!err);
        active++;
        assert(active === 1);
        setTimeout(release, 75 + Math.random() * 50);
      });
      function release() {
        // We have to decrement this before we start the call to
        // locks.unlock because otherwise the callback for one of our
        // peers' insert attempts may succeed before the callback for
        // remove, leading to a false positive for test failure. -Tom
        active--;
        return locks.unlock('test', function(err) {
          assert(!err);
          successful++;
          if (successful === 4) {
            done();
          }
        });
      }
    }
  });

  it('with promises: should flunk a second lock by the same module', function() {
    var locks = apos.modules['apostrophe-locks'];
    return Promise.try(function() {
      return locks.lock('test');
    }).then(function() {
      return locks.lock('test')
        .catch(function(err) {
          // SHOULD fail
          assert(err);
        });
    }).then(function() {
      return locks.unlock('test');
    }).then(function() {
      return locks.unlock('test')
        .catch(function(err) {
          // SHOULD fail
          assert(err);
        });
    });
  });

  it('withLock method should run a function inside a lock', function() {
    var locks = apos.modules['apostrophe-locks'];
    return locks.withLock('test-lock', function() {
      return Promise.delay(50).then(function() {
        return 'result';
      });
    }).then(function(result) {
      assert(result === 'result');
    });
  });

  it('withLock method should be able to run again (lock released)', function() {
    var locks = apos.modules['apostrophe-locks'];
    return locks.withLock('test-lock', function() {
      return Promise.delay(50).then(function() {
        return 'result';
      });
    }).then(function(result) {
      assert(result === 'result');
    });
  });

  it('withLock method should hold the lock (cannot relock within fn)', function() {
    var locks = apos.modules['apostrophe-locks'];
    return locks.withLock('test-lock', function() {
      return Promise.delay(50).then(function() {
        return locks.lock('test-lock').then(function() {
          assert(false);
        }).catch(function(e) {
          assert(e);
        });
      });
    });
  });

  it('callbacks: withLock method should run a function inside a lock', function(done) {
    var locks = apos.modules['apostrophe-locks'];
    return locks.withLock('test-lock', function(callback) {
      return setTimeout(function() {
        return callback(null, 'result');
      }, 50);
    }, function(err, result) {
      assert(!err);
      assert(result === 'result');
      done();
    });
  });

  it('all locks should be gone from the database', function() {
    var locks = apos.modules['apostrophe-locks'];
    return locks.db.find({}).toArray().then(function(locks) {
      assert(!locks.length);
      assert(!_.keys(locks.intervals).length);
    });
  });

});
