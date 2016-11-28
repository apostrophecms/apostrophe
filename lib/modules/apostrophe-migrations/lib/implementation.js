var async = require('async');

module.exports = function(self, options) {

  self.migrations = [];

  self.enableCache = function() {
    self.cache = self.apos.caches.get(self.__meta.name);
  };

  self.addMigrationTask = function() {
    self.apos.tasks.add(self.__meta.name, 'migrate', 'Apply any necessary migrations to the database.', self.migrationTask);
  };

  self.migrationTask = function(apos, argv, callback) {
    return self.migrate(argv, callback);
  };
    
  self.migrate = function(options, callback) {
    return self.apos.locks.lock(self.__meta.name, function(err) {
      if (err) {
        return callback(err);
      }
      return async.eachSeries(self.migrations, function(migration, callback) {
        if (options.safe && (!migration.options.safe)) {
          return setImmediate(callback);
        }
        return self.runOne(migration, function(err) {
          return callback(err);
        });
      }, function(err) {
        return self.apos.locks.unlock(self.__meta.name, function(_err) {
          return callback(err || _err);
        });
      });
    });
  };

  self.runOne = function(migration, callback) {
    return self.cache.get(migration.name, function(err, info) {
      if (err) {
        return callback(err);
      }
      if (info) {
        // We don't need to run it again
        return callback(null);
      }
      console.log('Running database migration: ' + migration.name);
      return migration.callback(function(err) {
        if (err) {
          console.error(err);
          return callback(err);
        }
        return self.cache.set(migration.name, true, callback);
      });
    });
  };
};
