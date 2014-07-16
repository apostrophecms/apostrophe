var _ = require('lodash');

 /**
 * cache
 * @augments Augments the apos object with methods supporting caching.
 */

module.exports = function(self) {
  // getCache('cachename') returns an object on which you may call .get and .set to get
  // and store values in the cache. If you call getCache('pollywobbles'), your get and set
  // methods will only interact with data stored in the pollywobbles cache. You may also
  // call .clear on a cache. All three methods require a callback.
  //
  // The default implementation is a single MongoDB collection but this can be swapped out
  // by overriding the getCache method.
  //
  // Note that the .set method takes an optional lifetime in seconds for the cached data.
  // If no lifetime is specified the data is cached forever.

  self.getCache = function(name) {
    if (!self._caches) {
      self._caches = {};
    }
    if (!self._caches[name]) {
      self._caches[name] = self.constructCache(name);
    }
    return self._caches[name];
  };

  self.constructCache = function(name) {
    return {
      get: function(key, callback) {
        return self._cache.findOne({
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
      // Cache lifetime is optional
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
        return self._cache.update(
          {
            name: name,
            key: key
          },
          action,
          {
            upsert: true
          }, callback);
      },
      clear: function(callback) {
        return self._cache.remove({
          name: name
        }, callback);
      }
    };
  };
};
