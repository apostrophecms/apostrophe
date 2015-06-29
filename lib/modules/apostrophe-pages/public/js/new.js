apos.define('apostrophe-pages-new', {
  extend: 'apostrophe-modal',
  source: 'new',
  construct: function(self, options) {
    self.typeChoices = options.typeChoices;
    self.schema = options.schema;
    self.beforeShow = function(callback) {
      var data = apos.schemas.newInstance(self.schema);
      return apos.schemas.populate(self.$el, self.schema, data, callback);
    };
    self.beforeSave = function(callback) {
      return setImmediate(callback);
    }
    self.save = function(callback) {
      var page;
      return async.series({
        convert: function(callback) {
          return apos.schemas.convert(self.$el, self.schema, page, callback);
        },
        beforeSave: function(callback) {
          return self.beforeSave(callback);
        },
        save: function(callback) {
          return $.jsonCall(self.action + '/new', page, function(data) {
            if (data.status !== 'ok') {
              alert('An error occurred while creating the page: ' + data.status);
              return callback(data.status);
            }
            var url = data.url;
            // Go to the new page
            window.location.href = url;
          });
        }
      }, callback);
    }
  }
});
