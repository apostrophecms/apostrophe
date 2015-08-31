var async = require('async');

module.exports = {

  enabled: true,

  alias: 'versions',

  afterConstruct: function(self, callback) {
    if (!self.options.enabled) {
      return setImmediate(callback);
    }

    return async.series([
      self.enableCollection,
      self.ensureIndexes
    ], callback);
  },

  construct: function(self, options) {
    if (!self.options.enabled) {
      return;
    }

    require('./lib/api.js')(self, options);
    require('./lib/routes.js')(self, options);
    require('./lib/browser.js')(self, options);
  }
};
