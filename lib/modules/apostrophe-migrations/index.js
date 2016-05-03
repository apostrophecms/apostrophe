module.exports = {

  alias: 'migrations',

  afterConstruct: function(self) {
    self.enableCache();
    self.addMigrationTask();
  },

  construct: function(self, options) {
    require('./lib/api.js')(self, options);
    require('./lib/implementation.js')(self, options);
  }
};
