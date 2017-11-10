var _ = require('lodash');
var async = require('async');

module.exports = {
  collectionName: 'aposJobs',

  afterConstruct: function(self, callback) {
    // Make sure it's enabled for this particular subclass of pieces
    if (!self.options.import) {
      return setImmediate(callback);
    }
    self.addRoutes();
    self.pushAssets();
    self.pushDefineRelatedTypes();
    return self.ensureCollection(callback);
  },

  construct: function(self, options) {

    require('./lib/routes.js')(self, options);
    require('./lib/api.js')(self, options);
    require('./lib/implementation.js')(self, options);
        
  }
};
