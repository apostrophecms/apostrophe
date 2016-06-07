var _ = require('lodash');
var async = require('async');

module.exports = function(self, options) {

  self.addFieldType = function() {
    self.apos.schemas.addFieldType({
      name: self.name,
      partial: self.fieldTypePartial,
      extend: 'url'
    });
  };

  self.fieldTypePartial = function(data) {
    return self.partial('video', data);
  };

};

