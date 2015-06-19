apos.define('apostrophe-widget-editor', {
  extend: 'apostrophe-modal',
  source: 'modal',
  construct: function(self, options) {
    self.data = options.data || {};
    self.save = function(callback) {
      return async.series({
        convert: function(callback) {
          return apos.schemas.convert(self.$el, self.options.schema, self.data, function(err) {
            if (err) {
              return callback(err);
            }
            return callback(null);
          });
        },
        beforeSave: function(callback) {
          return self.beforeSave(callback);
        },
        save: function(callback) {
          return options.save(self.getData(), callback);
        }
      }, callback);
    };
    self.beforeSave = function(callback) {
      return setImmediate(callback);
    };
    self.beforeShow = function(callback) {
      return async.series({
        populate: function(callback) {
          return apos.schemas.populate(self.$el, self.options.schema, self.data, callback);
        }
      }, callback);
    };
    self.getData = function() {
      return self.data;
    };
  }
});
