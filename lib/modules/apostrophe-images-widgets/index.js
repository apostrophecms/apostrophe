var _ = require('lodash');

module.exports = {
  extend: 'apostrophe-pieces-widgets',
  label: 'Image(s)',
  beforeConstruct: function(self, options) {
    // Add a relationship with cropping coordinates to the join.
    // We don't have any opinion on other aspects of that join, so
    // use alterFields, and take care to call any alterFields function
    // provided downstream. -Tom
    var superAlterFields = options.alterFields || function(schema) {};
    options.alterFields = function(schema) {
      var join = _.find(schema, { name: '_pieces' });
      if (join) {
        join.relationshipsField = 'relationships';
        join.relationship = [
          // These are nullable; if left is null there is no crop.
          {
            type: 'integer',
            def: null,
            name: 'left',
            label: 'Left'
          },
          {
            type: 'integer',
            def: null,
            name: 'top',
            label: 'Top'
          },
          {
            type: 'integer',
            def: null,
            name: 'width',
            label: 'Width'
          },
          {
            type: 'integer',
            def: null,
            name: 'height',
            label: 'Height'
          },
        ];
      }
      superAlterFields(schema);
    };
  },
  construct: function(self, options) {
    self.pushAssets = function(){
      self.pushAsset('stylesheet', 'user', { when: 'user' });
    };
  },
  afterConstruct: function(self) {
    self.pushAssets();
  },
};
