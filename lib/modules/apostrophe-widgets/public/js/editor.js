apos.define('apostrophe-widgets-editor', {
  extend: 'apostrophe-modal',
  source: 'modal',
  transition: 'slide',
  construct: function(self, options) {
    self.schema = self.options.schema;
    self.data = options.data || {};
    self.errorPath = options.data._errorPath;
    self.error = options.data._error;
    if (!self.data._id) {
      self.data._id = apos.utils.generateId();
    }
    self.saveContent = function(callback) {
      return async.series({
        convert: function(callback) {
          return apos.schemas.convert(self.$el, self.schema, self.data, function(err) {
            if (err) {
              return callback(err);
            }
            _.each(self.schema, function(field) {
              if ((field.type === 'area') || (field.type === 'singleton')) {
                if (!_.has(self.data, field.name)) {
                  // Even if these are contextual, we still need them to exist
                  self.data[field.name] = { type: 'area', items: [] };
                }
                // If we created the widget that contains an area, we can
                // also edit the area (just a hint to the UI, the server
                // handles enforcement for the whole doc)
                self.data[field.name]._edit = true;
              }
            });
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
      self.$form = self.$el.find('[data-apos-form]');
      self.$form.on('change', self.onChange);
      return async.series({
        populate: function(callback) {
          return apos.schemas.populate(self.$el, self.schema, self.data, callback);
        }
      }, callback);
    };

    // Wait for afterShow to do things that might pop more modals
    self.afterShow = function() {
      return async.series({
        errorPath: function(callback) {
          if (self.errorPath && self.errorPath.length) {
            return apos.schemas.returnToError(self.$el, self.schema, self.errorPath, self.error, callback);
          } else {
            return callback(null);
          }
        },
        clearError: function(callback) {
          self.error = null;
          self.errorPath = null;
          return callback(null);
        }
      }, function(err) {
        if (err) {
          return apos.utils.warn(err);
        }

      });
    };

    self.getData = function() {
      return self.data;
    };

    self.onChange = function(e) {
      if (!self.unsavedChanges) {
        self.unsavedChanges = true;
      }
    };
  }
});
