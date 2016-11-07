apos.define('apostrophe-pages-editor', {
  extend: 'apostrophe-modal',
  source: 'editor',
  verb: 'insert',
  label: 'New Page',
  construct: function(self, options) {
    self.typeChoices = apos.pages.options.typeChoices;
    self.schema = apos.pages.options.schema;
    self.page = apos.pages.page;
    self.verb = self.options.verb;
    self.label = self.options.label;

    // Current page type name
    self.type = self.page.type;

    // data to send to the source
    self.body = {
      type: self.type,
      verb: self.verb
    };

    self.beforeShow = function(callback) {
      var $type = apos.schemas.findField(self.$el, 'type');
      $type.on('change', function() {
        self.changedType($type.val());
      });
      return self.open(callback);
    };

    self.open = function(callback) {
      return self.api(
        'fetch-to-' + self.verb,
        {
          _id: self.page._id,
          type: self.type
        }, function(result) {
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
    self.saveContent = function(callback) {
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

    self.changedType = function(type) {

      var page = {};
      return async.series({
        convert: function(callback) {
          return self.convert(page, function(err) {
            // errors are OK here because we are just switching
            // page types. We want as much data as we can get for
            // the new page type to populate with
            return callback(null);
          });
        },
        fetch: function(callback) {
          return self.api('fetch-to-' + self.verb, { _id: self.page._id, type: type }, function(result) {
            if (result.status === 'notfound') {
              alert('That page does not exist.');
              return callback('error');
            } else if (result.status !== 'ok') {
              alert('An error occurred. Please try again.');
              return callback('error');
            }
            self.schema = result.schema;
            return callback(null);
          }, function() {
            return callback('network');
          });
        },
        editor: function(callback) {
          return self.html('editor', { type: type, verb: self.verb }, function(html) {
            var $html = $(html);
            var $newFields = $html.find('[data-page-schema-fields]').children();
            var $wrapper = self.$el.find('[data-page-schema-fields]');
            $wrapper.html('');
            $wrapper.append($newFields);
            return callback(null);
          }, function() {
            return callback('network');
          });
        },
        refresh: function(callback) {
          // Repopulate with what we know so far from editing
          // prior to the page type change
          return self.populate(page, callback);
        }
      }, function(err) {
        if (err) {
          alert('An error occurred. Please try again.');
          return;
        }
        apos.emit('enhance', self.$el.find('[data-page-schema-fields]'));
        self.type = type;
      });
    };
  }
});

// A subclass for updating rather than inserting.
// Could be more exciting later

apos.define('apostrophe-pages-editor-update', {
  extend: 'apostrophe-pages-editor',
  verb: 'update',
  label: 'Edit Page Settings'
});

apos.define('apostrophe-pages-editor-copy', {
  extend: 'apostrophe-pages-editor',
  verb: 'copy',
  label: 'Copy Page'
});
