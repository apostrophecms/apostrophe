let _ = require('lodash');

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
// ### `db`
//
// An existing MongoDB connection object. If present, a new
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
// Note that `apos.db` is the mongodb connection object, not this module.
// You shouldn't need to talk to this module after startup, but you can
// access it as `apos.modules['apostrophe-db']` if you wish.
//
// If you need to change the way MongoDB connections are made,
// override `connectToMongo` in `lib/modules/apostrophe-db/index.js`
// in your project.

let mongo = require('mongodb');

module.exports = {
  afterConstruct: async function(self, options) {
    await self.connectToMongo();
    await self.earlyResetTask();
  },
  construct: function(self, options) {
    // Open the database connection. Always use MongoClient with its
    // sensible defaults. Build a URI if we need to, so we can call it
    // in a consistent way.
    //
    // One default we override: if the connection is lost, we keep
    // attempting to reconnect forever. This is the most sensible behavior
    // for a persistent process that requires MongoDB in order to operate.
    self.connectToMongo = async function() {
      // TODO merge our mongo 3 driver support here
      if (self.options.db) {
        // Reuse a single connection http://mongodb.github.io/node-mongodb-native/2.2/api/Db.html#db
        self.apos.db = self.options.db.db(options.name || self.apos.shortName);
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
      const baseOptions = {
        autoReconnect: true,
        // retry forever
        reconnectTries: Number.MAX_VALUE,
        reconnectInterval: 1000
      };
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

      // If a comma separated host list or srv URI appears, it's a replica set or sharded
      // cluster. In either case, the autoReconnect feature is undesirable and
      // will actually cause problems, per the MongoDB team:
      //
      // https://github.com/apostrophecms/apostrophe/issues/1508

      if (multiple(uri)) {
        delete baseOptions.autoReconnect;
        delete baseOptions.reconnectTries;
        delete baseOptions.reconnectInterval;
      }

      const connectOptions = _.assign(baseOptions, self.options.connect || {});
      self.apos.db = await mongo.MongoClient.connect(uri, connectOptions);

      function multiple(uri) {
        // "Why don't we use a URL parser?" Because MongoDB has historically
        // supported some URL structures that might confuse one, like more than
        // one : in the host field.
        if (uri.match(/^mongodb\+srv/)) {
          return true;
        }
        const matches = uri.match(/\/\/([^/]+)/);
        if (!matches) {
          return false;
        }
        const host = decodeURIComponent(matches[1]);
        return !!host.match(/,/);
      }

    };

    // Remove ALL collections from the database as part of the
    // `apostrophe-db:reset` task. Then Apostrophe carries out the usual
    // reinitialization of collection indexes and creation of parked pages, etc.
    //
    // PLEASE NOTE: this will drop collections UNRELATED to apostrophe.
    // If that is a concern for you, drop Apostrophe's collections yourself
    // and start up your app, which will recreate them.

    self.earlyResetTask = async function() {
      if (self.apos.argv._[0] === 'apostrophe-db:reset') {
        return self.dropAllCollections();
      }
    };

    self.apos.tasks.add('apostrophe-db', 'reset',
      'Usage: node app apostrophe-db:reset\n\n' +
     'This destroys ALL of your content. EVERYTHING in your database.\n',
      async function(apos, argv) {
        return self.resetFromTask();
      }
    );

    self.resetFromTask = async function() {
      let argv = self.apos.argv;
      if (argv._.length !== 1) {
        throw new Error('Incorrect number of arguments.');
      }

      // let other modules run their own tasks now that db has been reset
      await self.emit('reset');
    };

    self.dropAllCollections = async function() {
      const collections = await self.apos.db.collections();
      for (const collection of collections) {
        // drop the collections. Cannot drop system collections
        // of MongoDB
        if (!collection.collectionName.match(/^system\./)) {
          await collection.drop();
        }
      }
    };

    // Closes the database connection and the keepalive
    // interval timer when Apostrophe shuts down.

    self.on('apostrophe:destroy', 'closeDb', async function() {
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
      await self.apos.db.close(false);
    });
  }
};
