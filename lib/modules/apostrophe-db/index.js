const _ = require('lodash');

// This module establishes `apos.db`, the mongodb driver connection object.
//
// ## Options
//
// ### `uri`
//
// The MongoDB connection URI. See the [MongoDB URI documentation](https://docs.mongodb.com/manual/reference/connection-string/).
//
// ### `connect`
//
// If present, this object is passed on as options to MongoDB's "connect" method,
// along with the uri. See the [MongoDB connect settings documentation](http://mongodb.github.io/node-mongodb-native/2.2/reference/connecting/connection-settings/).
//
// By default, Apostrophe sets options to retry lost connections forever, however
// you can override this via the `connect` object if you want to.
//
// ### `user`, `host`, `port`, `name`, `password`
//
// These options are used only if `uri` is not present.
//
// ### `client`
//
// An existing MongoDB connection (MongoClient) object. If present, a new
// connection instance is created that reuses the same sockets,
// and `uri`, `host`, `connect`, etc. are ignored.
//
// ## Command line tasks
//
// ### `apostrophe-db:reset`
//
// Drops ALL collections in the database (including those not created by
// Apostrophe), then emits the `apostrophe-db:reset` async event to
// allow other modules to drop related non-MongoDB resources at the
// same time, if desired.
//
// Note that `apos.db` is the mongodb database object, not this module.
// You shouldn't need to talk to this module after startup, but you can
// access it as `apos.modules['apostrophe-db']` if you wish. You can
// also access `apos.dbClient` if you need the MongoClient object.
//
// If you need to change the way MongoDB connections are made,
// override `connectToMongo` in `lib/modules/apostrophe-db/index.js`
// in your project. However you may find it easier to just use the
// `client` option.

let mongo = require('mongodb');

module.exports = {
  async init(self, options) {
    self.apos.tasks.add('apostrophe-db', 'reset', 'Usage: node app apostrophe-db:reset\n\n' + 'This destroys ALL of your content. EVERYTHING in your database.\n', async function (apos, argv) {
      return self.resetFromTask();
    });
    await self.connectToMongo();
    await self.earlyResetTask();
    // TODO: Remove this conditional and `self.trace` if not necessary or add
    // documentation explaining utility and usage.
    if (process.env.APOS_TRACE_DB) {
      self.trace();
    }
  },
  handlers(self, options) {
    return {
      'apostrophe:destroy': {
        async closeDb() {
          if (!self.apos.db) {
            return;
          }
          if (self.connectionReused) {
            // If we close our db object, which is reusing a connection
            // shared by someone else, they will lose their connection
            // too, resulting in unexpected "topology destroyed" errors.
            // This responsibility should fall to the parent
            return;
          }
          await self.apos.dbClient.close(false);
        }
      }
    };
  },
  methods(self, options) {
    return {
      // Open the database connection. Always use MongoClient with its
      // sensible defaults. Build a URI if we need to, so we can call it
      // in a consistent way.
      //
      // One default we override: if the connection is lost, we keep
      // attempting to reconnect forever. This is the most sensible behavior
      // for a persistent process that requires MongoDB in order to operate.
      async connectToMongo() {
        if (self.options.client) {
          // Reuse a single client connection http://mongodb.github.io/node-mongodb-native/2.2/api/Db.html#db
          self.apos.dbClient = self.options.client;
          self.apos.db = self.options.client.db(options.name || self.apos.shortName);
          self.connectionReused = true;
          return;
        }
        let Logger;
        if (process.env.APOS_MONGODB_LOG_LEVEL) {
          Logger = require('mongodb').Logger;
          // Set debug level
          Logger.setLevel(process.env.APOS_MONGODB_LOG_LEVEL);
        }
        let uri = 'mongodb://';
        if (process.env.APOS_MONGODB_URI) {
          uri = process.env.APOS_MONGODB_URI;
        } else if (options.uri) {
          uri = options.uri;
        } else {
          if (options.user) {
            uri += options.user + ':' + options.password + '@';
          }
          if (!options.host) {
            options.host = 'localhost';
          }
          if (!options.port) {
            options.port = 27017;
          }
          if (!options.name) {
            options.name = self.apos.shortName;
          }
          uri += options.host + ':' + options.port + '/' + options.name;
        }

        const connectOptions = self.options.connect || {};
        self.apos.dbClient = await mongo.MongoClient.connect(uri, connectOptions);
        const parsed = new URL(uri);
        self.apos.db = self.apos.dbClient.db(parsed.pathname.substr(1));
      },
      
      // TODO: Remove this function if not necessary. Created for debugging during
      // test conversion. If no conditional in `afterConstruct` above using this,
      // it can be safely removed.
      trace() {
        const superCollection = self.apos.db.collection;
        self.apos.db.collection = function (name, options, callback) {
          if (callback) {
            return superCollection.call(self.apos.db, name, options, function (err, collection) {
              if (err) {
                return callback(err);
              }
              decorate(collection);
              return callback(null, collection);
            });
          } else {
            const collection = superCollection.apply(self.apos.db, arguments);
            decorate(collection);
            return collection;
          }
          function decorate(collection) {
            wrap('insert');
            wrap('update');
            wrap('remove');
            wrap('aggregate');
            wrap('count');
            wrap('find');
            wrap('createIndex');
            function wrap(method) {
              var superMethod = collection[method];
              collection[method] = function () {
                /* eslint-disable-next-line no-console */
                console.trace(method);
                return superMethod.apply(collection, arguments);
              };
            }
          }
        };
      },
      
      // Remove ALL collections from the database as part of the
      // `apostrophe-db:reset` task. Then Apostrophe carries out the usual
      // reinitialization of collection indexes and creation of parked pages, etc.
      //
      // PLEASE NOTE: this will drop collections UNRELATED to apostrophe.
      // If that is a concern for you, drop Apostrophe's collections yourself
      // and start up your app, which will recreate them.
      
      async earlyResetTask() {
        if (self.apos.argv._[0] === 'apostrophe-db:reset') {
          return self.dropAllCollections();
        }
      },
      
      async resetFromTask() {
        let argv = self.apos.argv;
        if (argv._.length !== 1) {
          throw new Error('Incorrect number of arguments.');
        }
        
        // let other modules run their own tasks now that db has been reset
        await self.emit('reset');
      },
      
      async dropAllCollections() {
        const collections = await self.apos.db.collections();
        for (const collection of collections) {
          // drop the collections. Cannot drop system collections
          // of MongoDB
          if (!collection.collectionName.match(/^system\./)) {
            await collection.drop();
          }
        }
      }
    };
  }
};  
