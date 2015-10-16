var mongo = require('mongodb');
var async = require('async');

module.exports = {
  afterConstruct: function(self, callback) {
    async.series([
      self.connectToMongo,
      self.earlyResetTask
    ], callback);
  },
  construct: function(self, options) {
    // Open the database connection. Always use MongoClient with its
    // sensible defaults. Build a URI if we need to so we can call it
    // in a consistent way
    self.connectToMongo = function(callback){
      var uri = 'mongodb://';
      if (options.uri) {
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
      return mongo.MongoClient.connect(uri, function (err, dbArg) {
        self.apos.db = dbArg;
        if (err) {
          console.error('ERROR: There was an issue connecting to the database. Is it running?');
        }
        return callback(err);
      });
    };
  
    // reset task
    // let's all the modules start up, then destroys them bwhaha
    // the default is to remove everything.
    // TODO: --safe clears only collections that apostrophe cares about
    // - Tom & Sam
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
     'This destroys all of your content.\n',
     //TODO - figure out how to only drop apos-collections 
     //'If you want to drop all collections use --drop-all-collections \n' +
     //'Otherwise, only collections created by Apostrophe are dropped and recreated \n',
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


