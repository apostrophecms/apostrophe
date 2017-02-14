// A general purpose cache implementation for improved performance in all areas
// where results can be retained and reused temporarily. Any number of distinct cache
// objects can be created, identified by distinct names. The standard implementation
// is powered by a MongoDB collection, however it is straightforward to extend this
// module with a different implementation for some or all caches by overriding
// its `get` method.

var async = require('async');

module.exports = {

  alias: 'caches',

  afterConstruct: function(self, callback) {
    return self.getCollection(callback);
  },

  construct: function(self, options) {
    // `get('cachename')` returns a cache object to store things in
    // temporarily. If you call `get` many times with the same cache name,
    // you get the same cache object each time.
    //
    // CACHES MUST NEVER BE RELIED UPON TO STORE INFORMATION. They are a
    // performance enhancement ONLY and data may DISAPPEAR at any time.
    //
    // Every cache object provides `.get(key, callback)` and
    // `.set(key, value, lifetime, callback)` methods to get
    // and store values in the cache. The data to be
    // stored must be representable as JSON for compatibility with
    // different implementations. You do NOT have to stringify it yourself.
    //
    // The `.get` method of each cache object invokes its callback with `(null, value)` in the event
    // of success. If the key does not exist in the cache, `value`
    // is `undefined`. This is *not* considered an error.
    //
    // The `lifetime` argument of `.set` is in seconds and may be omitted
    // entirely, in which case data is kept indefinitely.
    //
    // The default implementation is a single MongoDB collection with a
    // `name` property to keep the caches separate, but this
    // can be swapped out by overriding the `get` method.
    //
    // CACHES MUST NEVER BE RELIED UPON TO STORE INFORMATION. They are a
    // performance enhancement ONLY and data may DISAPPEAR at any time.

    self.get = function(name) {
      if (!self.caches) {
        self.caches = {};
      }
      if (!self.caches[name]) {
        self.caches[name] = self.constructCache(name);
      }
      return self.caches[name];
    };

    self.constructCache = function(name) {
      return {
        // Fetch an item from the cache. If the item is in the
        // cache, the callback receives (null, item). If the
        // item is not in the cache the callback receives (null).
        // If an error occurs the callback receives (err).

        get: function(key, callback) {
          return self.cacheCollection.findOne({
            name: name,
            key: key
          }, function(err, item) {
            if (err) {
              return callback(err);
            }
            if (!item) {
              return callback(null);
            }
            // MongoDB's expireAfterSeconds mechanism isn't instantaneous, so we
            // should still enforce this at get() time
            if (item.expires && (item.expires < (new Date()))) {
              return callback(null);
            }
            return callback(null, item.value);
          });
        },
        // Store an item in the cache. `value` may be any JSON-friendly
        // value, including an object. `lifetime` is in seconds.
        //
        // The callback receives (err).
        //
        // You may also call with just three arguments:
        // key, value, callback. In that case there is no hard limit
        // on the lifetime, however NEVER use a cache for PERMANENT
        // store of data. It might be cleared at any time.

        set: function(key, value, lifetime, callback) {
          if (!callback) {
            callback = lifetime;
            lifetime = 0;
          }
          var action = {};
          var set = {
            name: name,
            key: key,
            value: value
          };
          action.$set = set;
          var unset = {};
          if (lifetime) {
            set.expires = new Date(new Date().getTime() + lifetime * 1000);
          } else {
            unset.expires = 1;
            action.$unset = unset;
          }
          return self.cacheCollection.update(
            {
              name: name,
              key: key
            },
            action,
            {
              upsert: true
            }, callback);
        },

        // Empty the cache.
        clear: function(callback) {
          return self.cacheCollection.remove({
            name: name
          }, callback);
        }
      };
    };

    self.getCollection = function(callback) {
      return self.apos.db.collection('aposCache', function(err, collection) {
        self.cacheCollection = collection;
        return async.series({
          keyIndex: function(callback) {
            return self.cacheCollection.ensureIndex({ key: 1, cache: 1 }, { unique: true }, callback);
          },
          expireIndex: function(callback) {
            return self.cacheCollection.ensureIndex({ updated: 1 }, { expireAfterSeconds: 0 }, callback);
          }
        }, callback);
      });
    };
  }
};
