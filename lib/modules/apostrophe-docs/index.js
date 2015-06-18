var async = require('async');
var _ = require('lodash');

module.exports = {

  alias: 'docs',

  afterConstruct: function(self, callback) {
    console.log(self.action);
    return async.series([ self.enableCollection, self.ensureIndexes ], function(err) {
      if (err) {
        return callback(err);
      }
      self.initializeBrowser();
      return callback(null);
    });
  },

  construct: function(self, options) {

    self.apos.define('apostrophe-cursor', require('./lib/cursor.js'));

    require('./lib/api.js')(self, options);
    require('./lib/routes.js')(self, options);
  }
};
