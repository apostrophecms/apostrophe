// This module establishes `apos.db`, the MongoDB database object.
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
// An existing MongoDB connection (MongoClient) object. If present, it is used
// and `uri`, `host`, `connect`, etc. are ignored.
//
// ### `versionCheck`
//
// If `true`, check to make sure the database does not belong to an
// older, incompatible major release release of Apostrophe and exit if it does.
// Defaults to `true`. You can set this to `false` to avoid an extra query at startup
// time.
//
// ## Command line tasks
//
// ### `@apostrophecms/db:reset`
//
// Drops ALL collections in the database (including those not created by
// Apostrophe), then emits the `@apostrophecms/db:reset` async event to
// allow other modules to drop related non-MongoDB resources at the
// same time, if desired.
//
// Note that `apos.db` is the MongoDB database object, not this module.
// You shouldn't need to talk to this module after startup, but you can
// access it as `apos.modules['@apostrophecms/db']` if you wish. You can
// also access `apos.dbClient` if you need the MongoClient object.
//
// If you need to change the way MongoDB connections are made,
// override `connectToMongo` in `modules/@apostrophecms/db/index.js`
// in your project. However you may find it easier to just use the
// `client` option.

const mongodbConnect = require('../../../lib/mongodb-connect');
const escapeHost = require('../../../lib/escape-host');

module.exports = {
  options: {
    versionCheck: true
  },
  async init(self) {
    await self.connectToMongo();
    await self.versionCheck();
  },
  handlers(self) {
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
  methods(self) {
    return {
      // Open the database connection. Always uses MongoClient with its
      // sensible defaults. Builds a URI if necessary, so we can call it
      // in a consistent way.
      //
      // One default we override: if the connection is lost, we keep
      // attempting to reconnect forever. This is the most sensible behavior
      // for a persistent process that requires MongoDB in order to operate.
      async connectToMongo() {
        if (self.options.client) {
          // Reuse a single client connection http://mongodb.github.io/node-mongodb-native/2.2/api/Db.html#db
          self.apos.dbClient = self.options.client;
          self.apos.db = self.options.client.db(self.options.name || self.apos.shortName);
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
        } else if (self.options.uri) {
          uri = self.options.uri;
        } else {
          if (self.options.user) {
            uri += self.options.user + ':' + self.options.password + '@';
          }
          if (!self.options.host) {
            self.options.host = 'localhost';
          }
          if (!self.options.port) {
            self.options.port = 27017;
          }
          if (!self.options.name) {
            self.options.name = self.apos.shortName;
          }
          uri += escapeHost(self.options.host) + ':' + self.options.port + '/' + self.options.name;
        }

        self.apos.dbClient = await mongodbConnect(uri, self.options.connect);
        self.uri = uri;
        const parsed = new URL(uri);
        self.apos.db = self.apos.dbClient.db(parsed.pathname.substring(1));

      },
      async versionCheck() {
        if (!self.options.versionCheck) {
          return;
        }
        const oldGlobal = await self.apos.db.collection('aposDocs').findOne({
          type: 'apostrophe-global'
        });
        if (oldGlobal) {
          throw new Error(`There is a problem with the database: ${self.uri ? (self.uri + ' ') : ''}

This database contains an Apostrophe 2.x website. Exiting to avoid content loss.`);
        }
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
  },
  tasks(self) {
    return {
      // Reset the database. Drops ALL collections. If you have
      // collections in the same database unrelated to Apostrophe they WILL
      // be removed.
      //
      // Then Apostrophe carries out the usual reinitialization of collection
      // indexes and creation of parked pages, etc.
      //
      // PLEASE NOTE: this will drop collections UNRELATED to apostrophe.
      // If that is a concern for you, drop Apostrophe's collections yourself
      // and start up your app, which will recreate them.
      reset: {
        usage: 'Usage: node app @apostrophecms/db:reset\n\nThis destroys ALL of your content. EVERYTHING in your database.\n',
        afterModuleInit: true,
        exitAfter: false,
        task: async () => {
          const argv = self.apos.argv;
          if (argv._.length !== 1) {
            throw new Error('Incorrect number of arguments.');
          }
          await self.dropAllCollections();
          // let other modules run their own tasks now that db has been reset
          await self.emit('reset');
        }
      }
    };
  }
};
