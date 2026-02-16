// This module establishes `apos.db`, the MongoDB database object.
//
// ## Options
//
// ### `uri`
//
// The databse connection URI. See the [MongoDB URI documentation](https://docs.mongodb.com/manual/reference/connection-string/)
// and the postgres documentation.
//
// ### `connect`
//
// If present, this object is passed on as options to the database adapters "connect"
// method, along with the uri. See the [MongoDB connect settings documentation](http://mongodb.github.io/node-mongodb-native/2.2/reference/connecting/connection-settings/).
//
// By default, Apostrophe sets options to retry lost connections forever,
// however you can override this via the `connect` object if you want to.
//
// ### `user`, `host`, `port`, `name`, `password`
//
// These options are used only if `uri` is not present.
//
// ### `client`
//
// An existing MongoDB-compatible client object. If present, it is used
// and `uri`, `host`, `connect`, etc. are ignored.
//
// ### `adapters`
//
// An array of adapters, each of which must provide `name`, `connect(uri, options)`,
// and `protocols` properties. `name` may be used to override a core adapter,
// such as `postgres` or `mongodb`. `connect` must resolve to a client object
// supporting a sufficient subset of the mongodb API.
//
// ### `versionCheck`
//
// If `true`, check to make sure the database does not belong to an
// older, incompatible major release release of Apostrophe and exit if it does.
// Defaults to `true`. You can set this to `false` to avoid an extra query at
// startup time.
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

const escapeHost = require('../../../lib/escape-host');
const mongodbAdapter = require('./adapters/mongodb.js');
const postgresAdapter = require('./adapters/postgres.js');

// Standalone function: connect to a database using the appropriate adapter
// based on the URI protocol. No side effects.
async function connectToAdapter(adapters, uri, options) {
  const matches = uri.match(/^([^:]+):\/\//);
  if (!matches) {
    throw new Error(`Invalid database URI: ${uri}`);
  }
  const protocol = matches[1];

  for (const adapter of adapters) {
    if (adapter.protocols.includes(protocol)) {
      return adapter.connect(uri, options);
    }
  }

  throw new Error(`No adapter found for protocol: ${protocol}`);
}

module.exports = {
  options: {
    versionCheck: true
  },
  async init(self) {
    // Build db adapters array, allowing custom adapters to override by name
    const named = new Map();
    for (const adapter of [
      mongodbAdapter,
      postgresAdapter,
      ...(self.options.adapters || [])
    ]) {
      named.set(adapter.name, adapter);
    }
    self.adapters = [...named.values()];
    await self.connectToDb();
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
      // Connect to the database and sets self.apos.dbClient and self.apos.db. Builds a mongodb URI
      // by default, accepting host, port, user, password and name options if present. More typically
      // a URI is specified via APOS_DB_URI, or via APOS_MONGODB_URI for bc. If nothing at all is
      // specified an unsecured connection to mongodb on localhost:27017 is attempted.
      async connectToDb() {
        if (self.options.client) {
          // Reuse a single client connection http://mongodb.github.io/node-mongodb-native/2.2/api/Db.html#db
          self.apos.dbClient = self.options.client;
          self.apos.db = self.options.client.db(self.options.name || self.apos.shortName);
          self.connectionReused = true;
          return;
        }
        let uri = 'mongodb://';
        const viaEnv = process.env.APOS_DB_URI || process.env.APOS_MONGODB_URI;
        if (viaEnv) {
          uri = viaEnv;
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

        self.apos.dbClient = await self.connectToAdapter(uri, self.options.connect);
        self.uri = uri;
        // Automatically uses the db name in the connection string
        self.apos.db = self.apos.dbClient.db();
      },
      // Connect to a database using the appropriate adapter based on the URI protocol.
      // Returns a client object compatible with the MongoDB driver interface.
      // This method has no side effects — it does not set apos.db or apos.dbClient.
      // It can be used to make temporary connections, e.g. for dropping a test database.
      async connectToAdapter(uri, options) {
        return connectToAdapter(self.adapters, uri, options);
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
        afterModuleReady: true,
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
