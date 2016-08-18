var async = require('async');
var _ = require('lodash');

module.exports = {

  alias: 'docs',

  afterConstruct: function(self, callback) {
    return async.series([ self.enableCollection, self.ensureIndexes ], callback);
  },

  construct: function(self, options) {

    self.apos.define('apostrophe-cursor', require('./lib/cursor.js'));

    require('./lib/api.js')(self, options);
    require('./lib/routes.js')(self, options);
    require('./lib/browser.js')(self, options);

    self.pushAssets();
    self.pushCreateSingleton();

  }
};
