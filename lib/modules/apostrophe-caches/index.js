// A general purpose cache implementation for improved performance in all areas
// where results can be retained and reused temporarily. Any number of distinct cache
// objects can be created, identified by distinct names. The standard implementation
// is powered by a MongoDB collection, however it is straightforward to extend this
// module with a different implementation for some or all caches by overriding
// its `get` method.
//
// **Read the documentation for the `get` method before proceeding.**
// The `get` method gives you a cache to store your data in.
// Then you call the methods **of that object** to actually
// store data.

module.exports = {

  alias: 'caches',

  afterConstruct: async function(self, options) {
    self.addClearCacheTask();
    await self.enableCollection();
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
    // HOW TO ACTUALLY CACHE DATA: **Every cache object has async `.get(key)` and
    // `.set(key, value, lifetime)` methods to get
    // and store values in the cache.** Don't forget to use the
    // `await` keyword.
    //
    // Example:
    //
    // ```
    // // Get a cache for weather data, keyed by zip code
    // const myCache = self.apos.caches.get('weather-data');
    //
    // // Store something in the cache
    // await myCache.set('19147', { clouds: 'cumulus' }, 86400);
    //
    // // Get a value from the cache
    // await myCache.get('19147');
    // ```
    //
    // The data to be stored must be representable as JSON for compatibility with
    // different implementations. You do NOT have to stringify it yourself.
    //
    // The `.get` method of each cache object returns the cached value.
    // If the key does not exist in the cache, `value`
    // is `undefined`. This is *not* considered an error and does
    // not throw an exception.
    //
    // The `lifetime` argument of `.set` is in seconds and may be omitted
    // entirely, in which case data is kept indefinitely (but NOT forever,
    // remember that caches can be erased at ANY time, they are not for permanent data storage).
    //
    // The default implementation is a single MongoDB collection with a
    // `name` property to keep the caches separate, but this
    // can be swapped out by overriding the `get` method.
    //
    // Caches also have a `clear()` method to clear the cache.
    // Don't forget to use `await`.
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
        // Fetch an item from the cache. Returns the item,
        // or `undefined` if it is not in the cache.
        // Be sure to use `await`.
        get: async function(key) {
          const item = await self.cacheCollection.findOne({
            name: name,
            key: key
          });
          if (!item) {
            return undefined;
          }
          // MongoDB's expireAfterSeconds mechanism isn't instantaneous, so we
          // should still enforce this at get() time
          if (item.expires && (item.expires < (new Date()))) {
            return undefined;
          }
          return item.value;
        },

        // Store an item in the cache. `value` may be any JSON-friendly
        // value, including an object. `lifetime` is in seconds.
        //
        // You may also call with just two arguments:
        // `key`, `value`. In that case there is no hard limit
        // on the lifetime, however NEVER use a cache for PERMANENT
        // storage of data. It might be cleared at any time.
        //
        // Be sure to use `await`.
        //
        // The data you store should be JSON-friendly.
        // You DO NOT have to stringify it yourself.

        set: async function(key, value, lifetime) {
          if (arguments.length === 2) {
            lifetime = 0;
          }
          const action = {};
          const set = {
            name: name,
            key: key,
            value: value
          };
          action.$set = set;
          const unset = {};
          if (lifetime) {
            set.expires = new Date(new Date().getTime() + lifetime * 1000);
          } else {
            unset.expires = 1;
            action.$unset = unset;
          }
          await self.cacheCollection.update(
            {
              name: name,
              key: key
            },
            action,
            {
              upsert: true
            }
          );
        },

        // Empty the cache. Be sure to use `await`.
        clear: async function() {
          return await self.cacheCollection.remove({
            name: name
          });
        }
      };
    };

    // Establish the collection that will store all of the caches and
    // set up its indexes.

    self.enableCollection = async function() {
      self.cacheCollection = await self.apos.db.collection('aposCache');
      await self.cacheCollection.createIndex({ key: 1, cache: 1 }, { unique: true });
      await self.cacheCollection.createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
    };

    // Command line task to clear a cache or caches by name.

    self.clearCacheTask = async function(argv) {
      var cacheNames = argv._.slice(1);
      if (!cacheNames.length) {
        return callback('A cache name or names must be given.');
      }
      for (let name of cacheNames) {
        await self.get(name).clear();
      }
    };

    self.addClearCacheTask = function() {
      self.apos.tasks.add('apostrophe-caches', 'clear',
        'Usage: node app apostrophe-caches:clear cachename cachename2...\n\n' +
        'Clears caches by name. If you are using apos.caches in your own code you will\n' +
        'know the cache name. Standard caches include "apostrophe-migrations",\n' +
        '"minify" and "oembed". Normally it is not necessary to clear them.',
        function(apos, argv) {
          return await self.clearCacheTask(argv);
        }
      );
    };
  }
};
