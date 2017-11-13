var _ = require('lodash');
var async = require('async');

module.exports = {

  collectionName: 'aposJobs',

  afterConstruct: function(self, callback) {
    self.addRoutes();
    self.pushAssets();
    return self.ensureCollection(callback);
  },

  construct: function(self, options) {

    require('./lib/routes.js')(self, options);
    require('./lib/api.js')(self, options);
    require('./lib/implementation.js')(self, options);
    require('./lib/browser.js')(self, options);
        
  }
};
