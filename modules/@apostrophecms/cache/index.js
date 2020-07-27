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
  options: { alias: 'cache' },
  async init(self, options) {
    self.addClearCacheTask();
    await self.enableCollection();
  },
  methods(self, options) {
    return {

      // Get the cached value associated with the specified key from the specified
      // namespace. Returns undefined if not found. Be sure to use `await`.

      async get(namespace, key) {
        const item = await self.cacheCollection.findOne({
          namespace,
          key
        });
        if (!item) {
          return undefined;
        }
        // MongoDB's expireAfterSeconds mechanism isn't instantaneous, so we
        // should still enforce this at get() time
        if (item.expires && item.expires < new Date()) {
          return undefined;
        }
        return item.value;
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
        if (arguments.length === 2) {
          lifetime = 0;
        }
        const action = {};
        const set = {
          namespace,
          key,
          value
        };
        action.$set = set;
        const unset = {};
        if (lifetime) {
          set.expires = new Date(new Date().getTime() + lifetime * 1000);
        } else {
          unset.expires = 1;
          action.$unset = unset;
        }
        await self.cacheCollection.updateOne({
          namespace,
          key
        }, action, { upsert: true });
      },

      // Clear the cache of all keys and values in the given namespace.
      // Be sure to use `await`.

      async clear(namespace) {
        return self.cacheCollection.removeMany({ namespace });
      },

      // Establish the collection that will store all of the caches and
      // set up its indexes.

      async enableCollection() {
        self.cacheCollection = await self.apos.db.collection('aposCache');
        await self.cacheCollection.createIndex({
          namespace: 1,
          key: 1
        }, { unique: true });
        await self.cacheCollection.createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
      },

      // Command line task to clear all values in a namespace.

      async clearCacheTask(argv) {
        let namespaces = argv._.slice(1);
        if (!namespaces.length) {
          throw new Error('A namespace or namespaces must be given.');
        }
        for (let namespace of namespaces) {
          await self.clear(namespace);
        }
      },

      addClearCacheTask() {
        self.apos.task.add('@apostrophecms/cache', 'clear', 'Usage: node app @apostrophecms/cache:clear namespace1 namespace2...\n\n' + 'Clears all values stored in a given namespace or namespaces. If you are using apos.cache in your own code you will\n' + 'know the namespace name. Standard caches include "@apostrophecms/oembed". Normally it is not necessary to clear them.', async function (apos, argv) {
          return self.clearCacheTask(argv);
        });
      }
    };
  }
};
