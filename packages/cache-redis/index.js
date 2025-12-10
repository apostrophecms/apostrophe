const { createClient } = require('redis');

module.exports = {
  improve: '@apostrophecms/cache',
  methods(self) {
    return {
      // Fully replace the `enableCollection` method from core.
      async enableCollection() {
        const redisOptions = self.options.redis || {};

        if (!self.options.prefix) {
          if (self.options.prefix !== false) {
            // Distinguish sites
            self.options.prefix = self.apos.shortName + ':';
          }
        }

        self.prefix = self.options.prefix || '';

        self.client = createClient(redisOptions);

        self.client.on('error', (err) => {
          self.apos.util.error('Redis Client Error', err);
        });

        // Redis 4 requires explicit connection.
        await self.client.connect();
      },
      getRedisKey(namespace, key) {
        return `${self.prefix}:${namespace}:${key}`;
      },
      // Get the cached value associated with the specified key from the
      // specified namespace. Returns undefined if not found. Be sure to use
      // `await`.
      async get(namespace, key) {
        key = self.getRedisKey(namespace, key);

        const json = await self.client.get(key);

        if (!json) {
          return undefined;
        }

        let data;

        try {
          data = JSON.parse(json);
        } catch (error) {
          self.apos.util.error(error);
          // An error here is likely due to invalid JSON structure.
          return undefined;
        }

        return data;
      },

      // Cache a value under with the given key in the given namespace.
      // `value` may be any JSON-friendly value, including an object.
      // `lifetime` is in seconds. If zero or unspecified, there is no
      // time limit, however you must always assume the cache could be
      // cleared at some point. It is not for primary storage.
      //
      // Be sure to use `await`.
      //
      // The data you store should be JSON-friendly.
      // You DO NOT have to stringify it yourself.
      set: async function (namespace, key, value, lifetime) {
        if (arguments.length === 3) {
          lifetime = 0;
        }

        key = self.getRedisKey(namespace, key);

        if (lifetime) {
          return self.client.setEx(key, lifetime, JSON.stringify(value));
        } else {
          return self.client.set(key, JSON.stringify(value));
        }
      },

      // Clear the cache of all keys and values in the given namespace.
      // Be sure to use `await`.
      async clear(namespace) {
        // This is not as simple as it sounds:
        // https://stackoverflow.com/questions/4006324/how-to-atomically-delete-keys-matching-a-pattern-using-redis
        //
        // We're avoiding Lua because of comments in that article that it might
        // not play nice with Redis clustering.
        //
        // Use of `keys` is not deprecated as long as it's for a
        // special-purpose, occasional operation, and clearing an entire cache
        // qualifies.
        let keys = await self.client.keys(`${self.prefix}:${namespace}:*`);

        await removeNextBatch();

        async function removeNextBatch() {
          if (!keys.length) {
            return;
          }

          await self.client.del(keys.slice(0, 1000));

          keys = keys.slice(1000);

          return removeNextBatch();
        }

      },
      async delete(namespace, key) {
        key = self.getRedisKey(namespace, key);
        return self.client.del(key);
      }
    };
  },
  handlers(self) {
    return {
      'apostrophe:destroy': {
        closeRedisConnection () {
          self.client.quit();
        }
      }
    };
  }
};
