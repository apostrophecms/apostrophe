var _ = require('lodash');

module.exports = function(self, options) {

  self.migrations = [];

  // How we now track migrations performed: a mongodb collection (persistent)
  self.enableCollection = async function() {
    self.db = await self.apos.db.collection('aposMigrations');
  };

  self.addMigrationTask = function() {
    self.apos.tasks.add(self.__meta.name, 'migrate', 'Apply any necessary migrations to the database.', self.migrationTask);
  };

  self.migrationTask = async function(apos, argv) {
    return await self.migrate(argv);
  };

  self.afterInit = function() {
    // Add migrations for all Sortified schema fields in doc types
    self.addSortifyMigrations();
    // Add our own migration at the last possible minute so we can
    // prepend before all others
    self.addCollectionMigration();
  };

  self.addSortifyMigrations = function() {
    const managers = self.apos.docs.managers;
    _.each(managers, function(manager, name) {
      const schema = manager.schema;
      if (!schema) {
        return;
      }
      _.each(schema, function(field) {
        if (field.name === 'title') {
          // Was always sortified, migration would be redundant
          return;
        }
        if (!field.sortify) {
          return;
        }
        manager.addSortifyMigration(field.name);
      });
    });
  };

  // Perform the actual migrations. Implementation of
  // the apostrophe-migrations:migrate task
  self.migrate = async function(options) {
    await self.apos.locks.lock(self.__meta.name);
    try {
      for (migration of self.migrations) {
        await self.runOne(migration);
      }
    } finally {
      await self.apos.locks.unlock(self.__meta.name);
    }
  };

  self.runOne = async function(migration) {
    const info = await self.db.findOne({ _id: migration.name });
    if (info) {
      // We don't need to run it again
      return;
    }
    self.apos.utils.log('Running database migration: ' + migration.name);
    try {
      await migration.fn();
      await self.db.insert({ _id: migration.name, at: new Date() });
    } catch (err) {
      if (err) {
        self.apos.utils.error(err);
        throw err;
      }
    }
  };
};
