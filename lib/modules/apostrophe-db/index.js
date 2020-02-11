var _ = require('@sailshq/lodash');

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
// Apostrophe), then invokes the `dbReset` method of every module that
// has one. These methods may optionally take a callback.
//
// Note that `apos.db` is the mongodb connection object, not this module.
// You shouldn't need to talk to this module after startup, but you can
// access it as `apos.modules['apostrophe-db']` if you wish.
//
// If you need to change the way MongoDB connections are made,
// override `connectToMongo` in `lib/modules/apostrophe-db/index.js`
// in your project.

var mongo = require('emulate-mongo-2-driver');
var async = require('async');

module.exports = {
  afterConstruct: function(self, callback) {
    return async.series([
      self.connectToMongo,
      self.earlyResetTask
    ], function(err) {
      if (err) {
        return callback(err);
      }
      if (process.env.APOS_TRACE_DB) {
        self.trace();
      }
      self.keepalive();
      self.bcPatch();
      return callback(null);
    });
  },
  construct: function(self, options) {
    // Open the database connection. Always use MongoClient with its
    // sensible defaults. Build a URI if we need to, so we can call it
    // in a consistent way.
    //
    // One default we override: if the connection is lost, we keep
    // attempting to reconnect forever. This is the most sensible behavior
    // for a persistent process that requires MongoDB in order to operate.
    self.connectToMongo = function(callback) {
      if (self.options.db) {
        // Reuse a single connection http://mongodb.github.io/node-mongodb-native/2.2/api/Db.html#db
        self.apos.db = self.options.db.db(options.name || self.apos.shortName);
        self.connectionReused = true;
        return callback(null);
      }
      var Logger;
      if (process.env.APOS_MONGODB_LOG_LEVEL) {
        Logger = require('emulate-mongo-2-driver').Logger;
        // Set debug level
        Logger.setLevel(process.env.APOS_MONGODB_LOG_LEVEL);
      }
      var uri = 'mongodb://';
      var baseOptions = {
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
          options.host = '127.0.0.1';
        }
        if (!options.port) {
          options.port = 27017;
        }
        if (!options.name) {
          options.name = self.apos.shortName;
        }
        uri += options.host + ':' + options.port + '/' + options.name;
      }

      // If a comma separated host list appears, it's a replica set or sharded
      // cluster. In either case, the autoReconnect feature is undesirable and
      // will actually cause problems, per the MongoDB team:
      //
      // https://github.com/apostrophecms/apostrophe/issues/1508

      if (multiple(uri)) {
        delete baseOptions.autoReconnect;
        delete baseOptions.reconnectTries;
        delete baseOptions.reconnectInterval;
      }

      var connectOptions = _.assign(baseOptions, self.options.connect || {});
      return mongo.MongoClient.connect(uri, connectOptions, function (err, dbArg) {
        self.apos.db = dbArg;
        if (err) {
          self.apos.utils.error('ERROR: There was an issue connecting to the database. Is it running?');
        }
        return callback(err);
      });

      function multiple(uri) {
        // "Why don't we use a URL parser?" Because MongoDB has historically
        // supported some URL structures that might confuse one, like more than
        // one : in the host field.
        if (uri.match(/^mongodb\+srv/)) {
          return true;
        }
        var matches = uri.match(/\/\/([^/]+)/);
        if (!matches) {
          return false;
        }
        var host = decodeURIComponent(matches[1]);
        return !!host.match(/,/);
      }

    };

    // Query the server status every 10 seconds just to prevent
    // the mongodb module version 2.1.19+ or better from allowing
    // the connection to time out... with no error messages or clues
    // that we need to reconnect it... because apparently that's
    // a feature now. -Tom

    self.keepalive = function() {
      self.keepaliveCollection = self.apos.db.collection('aposKeepalive');

      self.keepaliveInterval = setInterval(function() {
        // We don't actually care about the result.
        return self.keepaliveCollection.findOne(function(err, dummy) {
          if (err) {
            self.apos.utils.error(err);
          }
        });
      }, 10000);
    };

    // Remove ALL collections from the database as part of the
    // `apostrophe-db:reset` task. Then Apostrophe carries out the usual
    // reinitialization of collection indexes and creation of parked pages, etc.
    //
    // PLEASE NOTE: this will drop collections UNRELATED to apostrophe.
    // If that is a concern for you, drop Apostrophe's collections yourself
    // and start up your app, which will recreate them.

    self.earlyResetTask = function(callback) {
      // if reset task is being run, destroy the collections
      // we have to do this now before all the modules try to recreate them
      // - Tom & Sam
      if (self.apos.argv._[0] === 'apostrophe-db:reset') {
        return self.dropAllCollections(callback);
      }
      return setImmediate(callback);
    };

    // Just a bc wrapper now that we are using emulate-mongo-2-driver,
    // which already adds findWithProjection as a synonym.

    self.bcPatch = function() {};

    self.apos.tasks.add('apostrophe-db', 'reset',
      'Usage: node app apostrophe-db:reset\n\n' +
     'This destroys ALL of your content. EVERYTHING in your database.\n',
      function(apos, argv, callback) {
        return self.resetFromTask(callback);
      }
    );

    self.resetFromTask = function(callback) {
      var argv = self.apos.argv;
      if (argv._.length !== 1) {
        return callback('Incorrect number of arguments.');
      }

      // let other modules run their own tasks now that db has been reset
      return self.callAllAndEmit('dbReset', 'reset', callback);
    };

    self.dropAllCollections = function(callback) {
      return self.apos.db.collections(function(err, collections) {
        if (err) {
          return callback(err);
        }

        // drop the collections
        return async.eachSeries(collections, function(collection, callback) {
          if (!collection.collectionName.match(/^system\./)) {
            return collection.drop(callback);
          }
          return setImmediate(callback);
        }, callback);
      });
    };

    // Invoked by `callAll` when `apos.destroy` is called.
    // Closes the database connection and the keepalive
    // interval timer. Sets `apos.db.closed` to true,
    // allowing detection of the fact that the database
    // connection is no longer available by code that
    // might still be in progress.

    self.apostropheDestroy = function(callback) {
      if (self.keepaliveInterval) {
        clearInterval(self.keepaliveInterval);
      }
      if (!self.apos.db) {
        return setImmediate(callback);
      }
      if (self.connectionReused) {
        // If we close our db object, which is reusing a connection
        // shared by someone else, they will lose their connection
        // too, resulting in unexpected "topology destroyed" errors.
        // This responsibility should fall to the parent
        return callback(null);
      }
      return self.apos.db.close(false, function(err) {
        if (err) {
          return callback(err);
        }
        self.apos.db.closed = true;
        return callback(null);
      });
    };

    self.trace = function() {
      var superCollection = self.apos.db.collection;
      self.apos.db.collection = function(name, options, callback) {
        if (callback) {
          return superCollection.call(self.apos.db, name, options, function(err, collection) {
            if (err) {
              return callback(err);
            }
            decorate(collection);
            return callback(null, collection);
          });
        } else {
          var collection = superCollection.apply(self.apos.db, arguments);
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
          wrap('ensureIndex');
          wrap('createIndex');
          wrap('distinct');
          function wrap(method) {
            var superMethod = collection[method];
            collection[method] = function() {
              /* eslint-disable-next-line no-console */
              console.trace(method);
              return superMethod.apply(collection, arguments);
            };
          }
        }
      };
    };
  }
};
