apos.define('apostrophe-pages-editor', {
  extend: 'apostrophe-modal',
  source: 'editor',
  verb: 'insert',
  construct: function(self, options, verb) {
    self.typeChoices = options.typeChoices;
    self.schema = options.schema;
    self.page = options.page;
    self.beforeShow = function(callback) {
      return self.open(verb, { _id: self.page._id }, callback);
    };
    self.open = function(verb, data, callback) {
      self.verb = verb;
      self.api('fetch-to-' + verb, data, function(result) {
        if (result.status === 'notfound') {
          alert('That page does not exist.');
          return callback('error');
        } else if (result.status !== 'ok') {
          alert('An error occurred. Please try again.');
          return callback('error');
        }
        return self.populate(result.data, callback);
      }, function() {
        alert('An error occurred. Please try again.');
        return callback('network');
      });
    };
    self.beforeSave = function(callback) {
      return setImmediate(callback);
    };
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
          return self.api(self.verb, page, function(data) {
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
    };
  }
});

// A subclass for updating rather than inserting.
// Could be more exciting later

apos.define('apostrophe-pages-editor-update', {
  extend: 'apostrophe-pages-editor',
  verb: 'update'
});

