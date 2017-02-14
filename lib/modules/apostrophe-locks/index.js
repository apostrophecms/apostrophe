var async = require('async');
var _ = require('lodash');

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
    // The `options` argument can be omitted completely.
    //
    // Calling this method when you already have the specified lock will
    // yield an error.
    //
    // SYNCHRONOUS CODE: if you need to go more than 30 seconds without ever returning to the
    // event loop, set `options.idleTimeout` to a longer period of time (in milliseconds).
    // This applies only to synchronous code. (And seriously, why  are you running
    // without returning for 5 minutes in nodejs? Nobody can see your site while you do that.)

    self.lock = function(name, options, callback) {

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

      if (arguments.length == 2) {
        callback = options;
        options = {};
      }
      
      self.intervals = self.intervals || {};
      if (self.intervals[name]) {
        return setImmediate(_.partial(callback, new Error("Attempted to lock " + name + " which we have already locked")));
      }

      var idleTimeout = options.idleTimeout || 30 * 1000;
      var lock;
      
      return attempt(afterAttempt);
      
      function attempt(callback) {

        when = Date.now();

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
          }, function(err) {
            return callback(err);
          });
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
            console.error(err);
          }
        });
      }

    };

    // Release the given lock name. You must first obtain a lock successfully
    // via `lock`. Calling this method when you do not already have the lock will
    // yield an error.

    self.unlock = function(name, callback) {
      self.intervals = self.intervals || {};
      if (!self.intervals[name]) {
        return setImmediate(_.partial(callback, new Error("Attempted to unlock " + name + " which is not locked")));
      }
      clearInterval(self.intervals[name]);
      delete self.intervals[name];
      return self.db.remove({ _id: name }, callback);
    };
    
    self.ensureCollection = function(callback) {
      self.db = self.apos.db.collection('aposLocks');
      // Currently we don't need any indexes so just invoke callback
      return setImmediate(callback);
    };
  }
};
