const migrations = require('./lib/migrations.js');

module.exports = {
  extend: '@apostrophecms/doc-type',
  options: {
    name: '@apostrophecms/polymorphic-type',
    showPermissions: false
  },
  init(self) {
    self.addMigrations();
  },
  methods(self) {
    return {
      ...migrations(self)
    };
  }
};
