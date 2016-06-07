var _ = require('lodash');
var async = require('async');

module.exports = {

  alias: 'videoFields',

  afterConstruct: function(self, callback) {
    return async.series({
      enableCollection: function(callback) {
        return self.enableCollection(callback);
      },
      initUploadfs: function(callback) {
        return self.initUploadfs(callback);
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      self.addFieldType();
      self.pushAssets();
      self.pushCreateSingleton();
      self.enableHelpers();
      return callback(null);
    });
  },

  construct: function(self, options) {
    self.name = 'video';
    self.oembedType = 'video';

    // self.enableHelpers = function() {
    //   self.addHelpers(_.pick(self, 'url', 'first', 'all'));
    // };

    require('./lib/schemaField')(self, options);
    require('./lib/api')(self, options);
    require('./lib/routes')(self, options);
    require('./lib/browser')(self, options);

  }
};
