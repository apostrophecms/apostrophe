// Provide services for database migration. The `apostrophe-migrations:migrate` task
// carries out all migrations that have been registered with this module. Migrations
// are used to make changes to the database at the time of a new code deployment,
// typically because we need to represent the data in a different way or correct
// errors.
//
// Migrations MUST be idempotent (it must be safe to run them twice). Apostrophe
// does remember whether they have been run before in a cache but there is
// NO guarantee that they will not run again when the cache is cleared. If this is
// difficult to guarantee, you may wish to write a task instead.

var Promise = require('bluebird');

module.exports = {

  alias: 'migrations',

  afterConstruct: function(self, callback) {
    self.enableCache();
    return self.enableCollection(function(err) {
      if (err) {
        return callback(err);
      }
      self.addMigrationTask();
      return callback(null);
    });
  },

  construct: function(self, options) {
    require('./lib/api.js')(self, options);
    require('./lib/implementation.js')(self, options);
    // Always run safe migrations at startup; why would we ever continue
    // with an inconsistent database?
    self.on('apostrophe:migrate', 'runRegisteredMigrations', function(options) {
      return Promise.promisify(self.migrate)(options);
    });
  }
};
