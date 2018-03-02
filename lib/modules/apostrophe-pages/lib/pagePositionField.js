var _ = require('lodash');

module.exports = function(self, options) {

  self.addFieldType = function() {
    self.apos.schemas.addFieldType({
      name: 'pagePosition',
      partial: self.positionPartial,
      converters: self.postionConverters
    });
  };

  self.positionFieldTypePartial = function(data) {
    return self.partial('position', data);
  };

  self.positionConverters = {
    string: function(req, data, name, object, field, callback) {
      // N/A outside of the page settings modal
      return setImmediate(callback);
    },
    form: function(req, data, name, object, field, callback) {
      var info = data[name];
      if (typeof (info) !== 'object') {
        info = {};
      }
      var target = self.apos.launder.id(info.target);
      var position = self.apos.launder.select(info.position, [ 'before', 'after', 'inside' ]);
      if (data.level === 0) {
        // home page cannot be moved
        object[name] = null;
        return setImmediate(callback);
      }  
      // Further validation will take place in the move method
      data[name] = {
        position: position,
        target: target
      };
      return setImmediate(callback);
    }
  };

};
