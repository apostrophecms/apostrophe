var async = require('async');
var _ = require('@sailshq/lodash');
var Promise = require('bluebird');

module.exports = {
  alias: 'locks',

  afterConstruct: function(self, callback) {
    return self.ensureCollection(callback);
  },

  construct: function(self, options) {

    // Obtain a lock with the given name. The lock remains exclusive until
    // we unlock it (except for certain situations in unusual synchronous code,
    // see below).
    //
    // We MUST release the lock later by calling `unlock` with the same name.
    //
    // If the lock is in use by another party, this method will wait until it is
    // no longer in use, unless `options.wait` is present. If `options.wait`
    // is explicitly `false`, the method will not wait at all, and
    // the error reported will be the string `'locked'`. If `options.wait`
    // is a number, the method will wait that many milliseconds before
    // reporting the `locked` error.
    //
    // The `options` argument can be omitted completely.
    //
    // Calling this method when you already have the specified lock will
    // yield an error unless the `waitForSelf` option is true.
    //
    // If you call without a callback, a promise is returned instead.
    //
    // SYNCHRONOUS CODE: if you need to go more than 30 seconds without ever returning to the
    // event loop, set `options.idleTimeout` to a longer period of time (in milliseconds).
    // This applies only to synchronous code. (And seriously, why  are you running
    // without returning for 5 minutes in nodejs? Nobody can see your site while you do that.)

    self.lock = function(name, options, callback) {

      if (process.env.APOS_TRACE_LOCKS) {
        /* eslint-disable-next-line no-console */
        console.trace('Locking ' + name);
      }

      // Implementation notes: since `_id` must be unique, we know
      // we have the lock if we succeed in inserting a mongodb doc with
      // an _id equal to the lock name. If we fail due to a duplicate key,
      // we just keep trying, with exponential backoff but no less than
      // every 100ms.
      //
      // A crashed process should not be allowed to camp on a lock forever,
      // so we also poll each time to see if the existing lock's `when` stamp is
      // older than the `idleTimeout`.

      var retryDelay = 10;
      var start = Date.now();

      if (typeof (options) !== 'object') {
        callback = options;
        options = {};
      }
      var wait = Number.MAX_VALUE;
      if (_.isNumber(options.wait)) {
        wait = options.wait;
      }
      if (options.wait === false) {
        wait = 0;
      }
      if (callback) {
        return body(callback);
      } else {
        return Promise.promisify(body)();
      }

      function body(callback) {

        self.intervals = self.intervals || {};
        if (self.intervals[name]) {
          if (options.waitForSelf) {
            return retry();
          }
          return setImmediate(function() {
            return callback(new Error("Attempted to lock " + name + " which we have already locked."));
          });
        }

        var idleTimeout = options.idleTimeout || 30 * 1000;
        var lock;

        return attempt(afterAttempt);

        function attempt(callback) {

          var when = Date.now();

          return async.series([
            fetch,
            timeout,
            insert
          ], callback);

          // We don't trust this for concurrency because it's not atomic.
          // We just use it to remove old locks if needed
          function fetch(callback) {
            return self.db.findOne({
              _id: name
            }, function(err, _lock) {
              if (err) {
                return callback(err);
              }
              lock = _lock;
              return callback(null);
            });
          }

          function timeout(callback) {
            if (!lock) {
              return callback(null);
            }
            if (lock.when + lock.idleTimeout >= when) {
              return callback(null);
            }
            return self.db.remove({
              _id: name,
              unique: lock.unique
            }, callback);
          }

          function insert(callback) {
            return self.db.insert({
              _id: name,
              when: when,
              idleTimeout: idleTimeout,
              unique: self.apos.utils.generateId()
            }, callback);
          }
        }

        function afterAttempt(err) {
          if (!err) {
            self.intervals[name] = setInterval(refresh, Math.min(idleTimeout / 4, 1000));
            return callback(null);
          }
          // Only duplicate keys should be retried
          if (err.code !== 11000) {
            return callback(err);
          }
          return retry();
        }

        function retry() {
          if (start + wait < Date.now()) {
            return callback('locked');
          }
          // Try try again
          setTimeout(function() {
            return attempt(afterAttempt);
          }, retryDelay);
          // Exponential backoff, but only to a reasonable limit
          retryDelay *= 2;
          if (retryDelay > 100) {
            retryDelay = 100;
          }
        }

        function refresh() {
          // For unit testing purposes we can test what happens when
          // idleTimeout is short and there is no auto-refresh happening
          if (options.noRefresh) {
            return;
          }
          if (!self.intervals[name]) {
            return;
          }
          return self.db.update({ _id: name }, { $set: { when: Date.now() } }, function(err) {
            if (err) {
              self.apos.utils.error(err);
            }
          });
        }
      }

    };

    // Release the given lock name. You must first obtain a lock successfully
    // via `lock`. Calling this method when you do not already have the lock will
    // yield an error.
    //
    // If you call without a callback, a promise is returned instead.

    self.unlock = function(name, callback) {

      if (process.env.APOS_TRACE_LOCKS) {
        /* eslint-disable-next-line no-console */
        console.trace('Unlocking ' + name);
      }

      if (callback) {
        return body(callback);
      } else {
        return Promise.promisify(body)();
      }

      function body(callback) {
        self.intervals = self.intervals || {};
        if (!self.intervals[name]) {
          return setImmediate(_.partial(callback, new Error("Attempted to unlock " + name + " which is not locked")));
        }
        clearInterval(self.intervals[name]);
        delete self.intervals[name];
        return self.db.remove({ _id: name }, callback);
      }

    };

    // Obtains the named lock, then invokes the provided function,
    // which must take one argument (a callback), or
    // take zero arguments and return a promise. Then `callback`
    // is invoked or, if there is no callback, an error is returned.
    //
    // You can think of this as an "upgrade" of your function to
    // run within a lock in every way. If you use promises,
    // the promise returned by `withLock` will resolve to the
    // value that `fn` resolves to. If you use callbacks, the
    // second argument is passed on as you would expect.
    //
    // You may omit `callback`, in which case `withLock`
    // returns a promise.
    //
    // The lock gets released at the end, whether fn results in an
    // error or not.

    self.withLock = function(name, fn, callback) {

      var result;

      if (callback) {
        return body(callback);
      } else {
        return Promise.promisify(body)();
      }

      function body(callback) {
        var locked = false;

        return async.series([ lock, fnWrapper ], function(err) {
          if (locked) {
            return self.apos.locks.unlock(name, function(_err) {
              return callback(err || _err, result);
            });
          }
          return callback(err, result);
        });

        // May take a callback or return a promise
        function fnWrapper(callback) {
          if (fn.length === 1) {
            return fn(function(err, _result) {
              result = _result;
              return callback(err);
            });
          } else {
            return fn().then(function(_result) {
              result = _result;
              return callback(null);
            }).catch(function(err) {
              return callback(err);
            });
          }
        }

        function lock(callback) {
          return self.apos.locks.lock(name, function(err) {
            if (err) {
              return callback(err);
            }
            locked = true;
            return callback(null);
          });
        }
      }

    };

    self.ensureCollection = function(callback) {
      self.db = self.apos.db.collection('aposLocks');
      // Currently we don't need any indexes so just invoke callback
      return setImmediate(callback);
    };
  }
};
