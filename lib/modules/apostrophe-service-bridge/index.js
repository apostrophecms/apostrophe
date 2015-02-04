var async = require('async');

module.exports = {
  construct: function(self, options, callback) {
    // Tell all the modules registered so far (aka the "core services")
    // that all services are ready. This module is loaded after the
    // core services and before all project level modules.
    return async.eachSeries(self.apos.modules, function(item, callback) {
      if (!item.servicesReady) {
        return setImmediate(callback);
      }
      if (item.servicesReady.length === 0) {
        item.servicesReady();
        return setImmediate(callback);
      }
      return item.servicesReady(callback);
    }, callback);
  }
};
