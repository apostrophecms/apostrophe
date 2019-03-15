const _ = require('lodash');
const Promise = require('bluebird');

module.exports = {
  alias: 'locks',

  afterConstruct: async function(self, options) {
    await self.ensureCollection();
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
    // wait for the previous lock to be released, unless the `waitForSelf` option
    // is explicitly `false`, in which case an error is thrown.
    //
    // SYNCHRONOUS CODE: if you need to go more than 30 seconds without ever returning to the
    // event loop, set `options.idleTimeout` to a longer period of time (in milliseconds).
    // This applies only to synchronous code. (And seriously, why  are you running
    // without returning for 5 minutes in nodejs? Nobody can see your site while you do that.)

    self.lock = async function(name, options) {

      // Implementation notes: since `_id` must be unique, we know
      // we have the lock if we succeed in inserting a mongodb doc with
      // an _id equal to the lock name. If we fail due to a duplicate key,
      // we just keep trying, with exponential backoff but no less than
      // every 100ms.
      //
      // A crashed process should not be allowed to camp on a lock forever,
      // so we also poll each time to see if the existing lock's `when` stamp is
      // older than the `idleTimeout`.

      const retryDelay = 10;
      const start = Date.now();

      options = options || {};
      const wait = Number.MAX_VALUE;
      if (_.isNumber(options.wait)) {
        wait = options.wait;
      }
      if (options.wait === false) {
        wait = 0;
      }

      self.intervals = self.intervals || {};
      if (self.intervals[name]) {
        if (options.waitForSelf !== false) {
          return await retry();
        } else {
          throw new Error("Attempted to lock " + name + " which we have already locked.");
        }
      }

      const idleTimeout = options.idleTimeout || 30 * 1000;
      let lock;

      return await attempt();

      async function attempt() {
        const when = Date.now();
        try {
          await fetch();
          await timeout();
          await insert();
          self.intervals[name] = setInterval(refresh, Math.min(idleTimeout / 4, 1000));
        } catch (err) {
          // Only duplicate keys should be retried
          if (err.code !== 11000) {
            throw err;
          }
          return await retry();
        }
      }

      // We don't trust this for concurrency because it's not atomic.
      // We just use it to remove old locks if needed
      async function fetch() {
        lock = await self.db.findOne({
          _id: name
        });
      }

      async function timeout() {
        if (!lock) {
          return;
        }
        if (lock.when + lock.idleTimeout >= when) {
          return;
        }
        await self.db.remove({
          _id: name,
          unique: lock.unique
        });
      }

      async function insert() {
        await self.db.insert({
          _id: name,
          when: when,
          idleTimeout: idleTimeout,
          unique: self.apos.utils.generateId()
        });
      }

      async function retry() {
        if (start + wait < Date.now()) {
          throw 'locked';
        }
        await Promise.delay(retryDelay);
        // Exponential backoff, but only to a reasonable limit
        retryDelay *= 2;
        if (retryDelay > 100) {
          retryDelay = 100;
        }
        return await attempt();
      }

      async function refresh() {
        // For unit testing purposes we can test what happens when
        // idleTimeout is short and there is no auto-refresh happening
        if (options.noRefresh) {
          return;
        }
        if (!self.intervals[name]) {
          return;
        }
        try {
          await self.db.update({ _id: name }, { $set: { when: Date.now() } });
        } catch (err) {
          // Not much more we can do with this error as the
          // lock method has returned and the operation is underway
          self.apos.utils.error(err);
        }
      }

    };

    // Release the given lock name. You must first obtain a lock successfully
    // via `lock`. Calling this method when you do not already have the lock will
    // yield an error.

    self.unlock = async function(name) {

      self.intervals = self.intervals || {};
      if (!self.intervals[name]) {
        throw new Error("Attempted to unlock " + name + " which is not locked");
      }
      clearInterval(self.intervals[name]);
      delete self.intervals[name];
      await self.db.remove({ _id: name });

    };

    // Obtains the named lock, awaits the provided function,
    // and then releases the lock whether the function throws
    // an error or not.
    //
    // You can think of this as an "upgrade" of your function to
    // run within a lock in every way.
    //
    // The return value of `withLock` will be the value that
    // `fn` returns. If `fn` throws an error it will be
    // re-thrown after the lock is safely released.

    self.withLock = async function(name, fn) {

      let result;

      let locked = false;

      try {
        await self.apos.locks.lock(name);
        locked = true;
        return await fn();
      } finally {
        if (locked) {
          await self.apos.locks.unlock(name);
        }
      }
    };

    self.ensureCollection = async function() {
      self.db = await self.apos.db.collection('aposLocks');
    };
  }
};
