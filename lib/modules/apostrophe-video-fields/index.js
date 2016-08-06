var _ = require('lodash');
var async = require('async');

module.exports = {

  // field type name
  name: 'video',

  // oembed response must be of this type (any if falsy)
  oembedType: 'video',

  alias: 'videoFields',

  afterConstruct: function(self) {
    self.addFieldType();
    self.pushAssets();
    self.pushCreateSingleton();
  },

  construct: function(self, options) {
    self.name = options.name;
    self.oembedType = options.oembedType;

    require('./lib/schemaField')(self, options);
    require('./lib/browser')(self, options);

  }
};
