// This module establishes `apos.db`, the mongodb driver connection object.
//
// ## Options
//
// ### `uri`
//
// The MongoDB connection URI.
//
// ### `user`, `host`, `port`, `name`, `password`
//
// These options are used only if `uri` is not present.
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

var mongo = require('mongodb');
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
      self.keepalive();
      return callback(null);
    });
  },
  construct: function(self, options) {
    // Open the database connection. Always use MongoClient with its
    // sensible defaults. Build a URI if we need to so we can call it
    // in a consistent way
    self.connectToMongo = function(callback) {
      var uri = 'mongodb://';
      
      if (process.env.APOS_MONGODB_URI) {
        uri = process.env.APOS_MONGODB_URI;
      } else if (options.uri) {
        uri = options.uri;
      }  else {
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
      return mongo.MongoClient.connect(uri, function (err, dbArg) {
        self.apos.db = dbArg;
        if (err) {
          console.error('ERROR: There was an issue connecting to the database. Is it running?');
        }
        return callback(err);
      });
    };

    // Query the server status every 10 seconds just to prevent
    // the mongodb module version 2.1.19+ or better from allowing
    // the connection to time out... with no error messages or clues
    // that we need to reconnect it... because apparently that's
    // a feature now. -Tom

    self.keepalive = function() {
      setInterval(function() {
        // We don't actually care about the result.
        return self.apos.db.admin().serverStatus(function(err, info) {});
      }, 10000);
    };

    // Remove ALL collections from the database as part of the
    // `apostrophe-db:reset` task. Then Apostrophe carries out the usual
    // reinitialization of collection indexes and creation of parked pages, etc.
    //
    // PLEASE NOTE: this will drop collections UNRELATED to apostrophe.
    // If that is a concern for you, drop Apostrophe's collections yourself
    // and start up your app, which will recreate them.

    self.earlyResetTask = function(callback){
      // if reset task is being run, destroy the collections
      // we have to do this now before all the modules try to recreate them
      // - Tom & Sam
      if(self.apos.argv._[0] === 'apostrophe-db:reset'){
        return self.dropAllCollections(callback);
      }
      return setImmediate(callback);
    }

    self.apos.tasks.add('apostrophe-db', 'reset',
     'Usage: node app apostrophe-db:reset \n\n' +
     'This destroys ALL of your content. EVERYTHING in your database.\n',
     function(apos, argv, callback) {
       return self.resetFromTask(callback);
     }
   );

   self.resetFromTask = function(callback){
     var argv = self.apos.argv;
     if(argv._.length !== 1 ){
       return callback('Incorrect number of arguments.');
     }

     // let other modules run their own tasks now that db has been reset
     return self.apos.callAll('dbReset', callback);
   };

   self.dropAllCollections = function(callback){
    return self.apos.db.collections(function(err, _collections) {
      if (err) {
        return callback(err);
      }
      collections = _collections;

      //drop the collections
      return async.eachSeries(collections, function(collection, callback) {
        if(!collection.collectionName.match(/^system\./)){
          return collection.drop(callback);
        }
        return setImmediate(callback);
      }, callback );
    });
   };
  }
};
