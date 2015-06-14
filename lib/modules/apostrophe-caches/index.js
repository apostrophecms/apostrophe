var async = require('async');

module.exports = {

  alias: 'caches',

  construct: function(self, options, callback) {
    // get('cachename') returns a cache object to store things in
    // temporarily. If you call many times with the same cache name,
    // you get the same cache object.
    //
    // The cache object implements .get and .set methods to get
    // and store values in the cache.
    //
    // If you call getCache('pollywobbles'), your get and set
    // methods will only interact with data stored in the pollywobbles
    // cache.
    //
    // You may also call .clear on a cache.
    //
    // All three methods require a callback.
    //
    // The default implementation is a single MongoDB collection but this
    // can be swapped out by overriding the getCache method.
    //
    // Note that the .set method takes an optional lifetime in seconds
    // for the cached data.
    //
    // If no lifetime is specified the data is cached forever.

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

    return self.apos.db.collection('aposCache', function(err, collection) {
      self.cacheCollection = collection;
      return async.series({
        keyIndex: function(callback) {
          return self.cacheCollection.ensureIndex({ key: 1, cache: 1 }, { safe: true, unique: true }, callback);
        },
        expireIndex: function(callback) {
          return self.cacheCollection.ensureIndex({ updated: 1 }, { expireAfterSeconds: 0 }, callback);
        }
      }, callback);
    });
  }
};
