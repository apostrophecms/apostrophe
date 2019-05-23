// A general purpose cache implementation for improved performance in all areas
// where results can be retained and reused temporarily. Any number of distinct cache
// objects can be created, identified by distinct names. The standard implementation
// is powered by a MongoDB collection, however it is straightforward to extend this
// module with a different implementation for some or all caches by overriding
// its `get` method.

var async = require('async');
var Promise = require('bluebird');

module.exports = {

  alias: 'caches',

  singletonWarningIfNot: 'apostrophe-caches',

  afterConstruct: function(self, callback) {
    self.addClearCacheTask();
    return self.getCollection(function(err) {
      if (err) {
        return callback(err);
      }
      self.on('apostrophe:migrate', 'ensureIndexesPromisified', function() {
        return require('bluebird').promisify(self.ensureIndexes)();
      });
      return callback(null);
    });
  },

  construct: function(self, options) {
    // **SLOW DOWN - READ CAREFULLY!**
    //
    // THIS IS NOT THE METHOD YOU CALL TO GET A VALUE - THIS IS
    // THE METHOD YOU CALL TO **GET A CACHE IN WHICH YOU CAN GET AND SET
    // VALUES.** Call it with a name that uniquely identifies
    // your **entire cache**, like `weather-data` or similar. The
    // object it **returns** has `get` and `set` methods for actual data,
    // **as described below**.
    //
    // `get('cachename')` returns a cache object to store things in
    // temporarily. If you call `get` many times with the same cache name,
    // you get the same cache object each time.
    //
    // CACHES MUST NEVER BE RELIED UPON TO STORE INFORMATION. They are a
    // performance enhancement ONLY and data may DISAPPEAR at any time.
    //
    // HOW TO ACTUALLY CACHE DATA: **Every cache object has `.get(key, callback)` and
    // `.set(key, value, lifetime, callback)` methods to get
    // and store values in the cache.** If you call without a callback,
    // a promise is returned.
    //
    // Example (with promises):
    //
    // ```
    // // Get a cache for weather data, keyed by zip code
    // var myCache = self.apos.caches.get('weather-data');
    //
    // // Store something in the cache
    // myCache.set('19147', { clouds: 'cumulus' }, 86400).then(function() { ... })
    //
    // // Get a value from the cache
    // myCache.get('19147').then(function(data) { ... })
    // ```
    //
    // The data to be stored must be representable as JSON for compatibility with
    // different implementations. You do NOT have to stringify it yourself.
    //
    // The `.get` method of each cache object invokes its callback with `(null, value)` in the event
    // of success. If the key does not exist in the cache, `value`
    // is `undefined`. This is *not* considered an error. If there is no callback
    // a promise is returned, which resolves to the cached value or `undefined`.
    //
    // The `lifetime` argument of `.set` is in seconds and may be omitted
    // entirely, in which case data is kept indefinitely (but NOT forever,
    // remember that caches can be erased at ANY time, they are not for permanent data storage).
    //
    // The default implementation is a single MongoDB collection with a
    // `name` property to keep the caches separate, but this
    // can be swapped out by overriding the `get` method.
    //
    // Caches also have a `clear()` method to clear the cache. If
    // no callback is passed, it returns a promise.
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
        // If there is no callback a promise is returned.

        get: function(key, callback) {
          if (callback) {
            return body(callback);
          } else {
            return Promise.promisify(body)();
          }
          function body(callback) {
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
          }
        },

        // Store an item in the cache. `value` may be any JSON-friendly
        // value, including an object. `lifetime` is in seconds.
        //
        // The callback receives (err).
        //
        // You may also call with just three arguments:
        // key, value, callback. In that case there is no hard limit
        // on the lifetime, however NEVER use a cache for PERMANENT
        // storage of data. It might be cleared at any time.
        //
        // If there is no callback a promise is returned.

        set: function(key, value, lifetime, callback) {
          if (arguments.length === 2) {
            lifetime = 0;
            return Promise.promisify(body)();
          } else if (arguments.length === 3) {
            if (typeof (lifetime) === 'function') {
              callback = lifetime;
              lifetime = 0;
              return body(callback);
            } else {
              return Promise.promisify(body)();
            }
          } else {
            return body(callback);
          }
          function body(callback) {
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
              }, callback
            );
          }
        },

        // Empty the cache. If there is no callback a promise is returned.
        clear: function(callback) {
          if (callback) {
            return body(callback);
          } else {
            return Promise.promisify(body)();
          }
          function body(callback) {
            return self.cacheCollection.remove({
              name: name
            }, callback);
          }
        }
      };
    };

    self.getCollection = function(callback) {
      return self.apos.db.collection('aposCache', function(err, collection) {
        if (err) {
          return callback(err);
        }
        self.cacheCollection = collection;
        return callback(null);
      });
    };

    self.ensureIndexes = function(callback) {
      return async.series({
        keyIndex: function(callback) {
          return self.cacheCollection.ensureIndex({ key: 1, cache: 1 }, { unique: true }, callback);
        },
        expireIndex: function(callback) {
          return self.cacheCollection.ensureIndex({ expires: 1 }, { expireAfterSeconds: 0 }, callback);
        }
      }, callback);
    };

    self.clearCacheTask = function(argv, callback) {
      var cacheNames = argv._.slice(1);
      if (!cacheNames.length) {
        return callback('A cache name or names must be given.');
      }
      return async.eachSeries(cacheNames, function(name, callback) {
        return self.get(name).clear(callback);
      }, callback);
    };

    self.addClearCacheTask = function() {
      self.apos.tasks.add('apostrophe-caches', 'clear',
        'Usage: node app apostrophe-caches:clear cachename cachename2...\n\n' +
        'Clears caches by name. If you are using apos.caches in your own code you will\n' +
        'know the cache name. Standard caches include "apostrophe-migrations",\n' +
        '"minify" and "oembed". Normally it is not necessary to clear them.',
        function(apos, argv, callback) {
          return self.clearCacheTask(argv, callback);
        }
      );
    };
  }
};
