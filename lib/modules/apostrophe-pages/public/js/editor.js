apos.define('apostrophe-pages-editor', {
  extend: 'apostrophe-modal',
  source: 'editor',
  verb: 'insert',
  construct: function(self, options) {
    self.typeChoices = apos.pages.options.typeChoices;
    self.schema = apos.pages.options.schema;
    self.page = apos.pages.options.page;
    self.verb = self.options.verb;
    self.beforeShow = function(callback) {
      apos.log('beforeShow');
      return self.open({ _id: self.page._id }, callback);
    };
    self.open = function(data, callback) {
      apos.log('open');
      self.api('fetch-to-' + self.verb, data, function(result) {
        if (result.status === 'notfound') {
          alert('That page does not exist.');
          return callback('error');
        } else if (result.status !== 'ok') {
          alert('An error occurred. Please try again.');
          return callback('error');
        }
        self.schema = result.schema;
        return self.populate(result.data, callback);
      }, function() {
        alert('An error occurred. Please try again.');
        return callback('network');
      });
    };
    self.populate = function(data, callback) {
      return apos.schemas.populate(self.$el, self.schema, data, callback);
    };
    self.beforeSave = function(callback) {
      return setImmediate(callback);
    };
    self.convert = function(page, callback) {
      return apos.schemas.convert(self.$el, self.schema, page, callback);
    };
    self.save = function(callback) {
      var page = {};
      return async.series({
        convert: function(callback) {
          return self.convert(page, callback);
        },
        beforeSave: function(callback) {
          return self.beforeSave(callback);
        },
        save: function(callback) {
          return self.api(self.verb, { currentPageId: self.page._id, page: page }, function(data) {
            if (data.status !== 'ok') {
              alert('An error occurred while creating the page: ' + data.status);
              return callback(data.status);
            }
            // Go to the new page
            window.location.href = data.url;
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
