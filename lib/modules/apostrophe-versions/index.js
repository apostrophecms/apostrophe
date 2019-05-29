// Provides versioning for all docs in Apostrophe. Every time a doc
// is updated, a new version of it is created in the `aposVersions` collection.
// A UI is provided for viewing past versions and rolling back to them.
//
// Versions contain only properties that are not marked as unsafe
// for rollback.
//
// For space reasons, older versions are gradually pruned to be more sparse
// (infrequent) as you go back in time, however an attempt is made to
// preserve most transitions between different individuals editing content.

var async = require('async');

module.exports = {

  enabled: true,

  alias: 'versions',

  afterConstruct: function(self, callback) {
    if (!self.options.enabled) {
      return setImmediate(callback);
    }
    return async.series([
      self.enableCollection
    ], function(err) {
      if (err) {
        return callback(err);
      }
      self.on('apostrophe:migrate', 'ensureIndexesPromisified', function() {
        return require('bluebird').promisify(self.ensureIndexes)();
      });
      return callback(null);
    });
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
