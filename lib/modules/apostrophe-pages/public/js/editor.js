// Edit page settings.
//
// Typically instantiated by the page settings button, however it can be instantiated
// programmatically to edit the page settings of a different page, in which case
// `options.page` must provide at least the `_id` and `type` properties.
//
// If the page settings of the current page are edited, after editing is complete the
// user is redirected to the page on save, to reflect all changes including slug edits.
//
// `options.afterSave` may be a function which takes a page object and a callback.
// The page object is the page as returned by the server after the save operation.

apos.define('apostrophe-pages-editor', {
  extend: 'apostrophe-modal',
  source: 'editor',
  verb: 'insert',
  label: 'New Page',
  construct: function(self, options) {
    self.typeChoices = apos.pages.options.typeChoices;
    self.page = options.page || apos.pages.page;
    self.verb = self.options.verb;
    self.label = self.options.label;

    // Current page type name unless we are inserting a brand new one,
    // in which case the server should make a suggestion
    self.type = (self.verb === 'insert') ? null : self.page.type;

    // data to send to the source
    self.body = {
      type: self.type,
      verb: self.verb,
      id: self.page._id
    };

    self.beforeShow = function(callback) {
      self.addTypeChangeHandler();
      return self.open(callback);
    };

    // Add a change event handler to the type field.
    // This is installed at initial load time and also
    // when the content is re-rendered due to a page
    // type change, resulting in a new type field element.

    self.addTypeChangeHandler = function() {
      var $type = apos.schemas.findField(self.$el, 'type');
      $type.on('change', function() {
        self.changedType($type.val());
      });
    };

    self.open = function(callback) {
      return self.api(
        'fetch-to-' + self.verb,
        {
          _id: self.page._id,
          type: self.type
        }, function(result) {
          if (result.status === 'notfound') {
            apos.utils.error('That page does not exist.');
            return callback('error');
          } else if (result.status !== 'ok') {
            apos.notify('An error occurred. Please try again.', { type: 'error' });
            return callback('error');
          }
          self.schema = result.schema;
          if (!self.type) {
            try {
              self.type = _.find(self.schema, { name: 'type' }).choices[0].value;
            } catch (e) {
              self.type = self.page.type;
            }
          }
          return self.populate(result.data, callback);
        }, function() {
          apos.notify('An error occurred. Please try again.', { type: 'error' });
          return callback('network');
        });
    };

    // Make sure the field indicated by options.field is initially visible
    self.afterShow = function() {
      if (self.options.field) {
        var $el = apos.schemas.findFieldset(self.$el, self.options.field);
        if ($el.length) {
          apos.schemas.showGroupContaining($el);
          $el.scrollintoview();
          $el.find('input,select,textarea').first().focus();
        }
      }
    };

    self.populate = function(data, callback) {
      return apos.schemas.populate(self.$el, self.schema, data, callback);
    };
    self.beforeSave = function(callback) {
      return setImmediate(callback);
    };
    self.afterSave = function(callback) {
      return setImmediate(callback);
    };
    self.convert = function(page, callback) {
      return apos.schemas.convert(self.$el, self.schema, page, callback);
    };
    // For pages, saveContent never invokes its callback except on an error,
    // because it redirects to the new page URL. To aid you in doing something
    // before that happens, the afterSave method is provided and can be overridden
    // as you see fit.
    self.saveContent = function(callback) {
      var page = {
        // provide _id so the slug deconfliction code knows
        _id: self.page._id
      };
      var data;
      return async.series({
        convert: function(callback) {
          return self.convert(page, callback);
        },
        beforeSave: function(callback) {
          return self.beforeSave(callback);
        },
        save: function(callback) {
          return self.api(self.verb, { currentPageId: self.page._id, page: page }, function(_data) {
            data = _data;
            if (data.status !== 'ok') {
              apos.notify('An error occurred while creating the page: ' + data.status, { type: 'error' });
              return callback(data.status);
            }
            self.savedPage = data.page;
            return callback(null);
          });
        },
        afterSave: function(callback) {
          if (self.options.afterSave) {
            return self.options.afterSave(self.savedPage, method);
          } else {
            return method();
          }
          function method() {
            return self.afterSave(callback);
          }
        },
        redirect: function(callback) {
          if (self.options.redirectIfSamePage || (self.options.redirectIfSamePage === undefined)) {
            if (self.page._id === apos.pages.page._id) {
              // The slug may have changed, etc. Reflect that
              window.location.href = data.url;
            }
          }
          return callback(null);
        }
      }, callback);
    };

    self.changedType = function(type) {
      apos.ui.globalBusy(true);
      var page = _.cloneDeep(self.page);
      return async.series({
        convert: function(callback) {
          return self.convert(page, function() {
            // We don't have an err param here because we are just switching
            // page types - We want as much data as we can get for
            // the new page type to populate with, but we can ignore
            // any unvalidated fields. -Tom
            return callback(null);
          });
        },
        fetch: function(callback) {
          return self.api('fetch-to-' + self.verb, { _id: self.page._id, type: type }, function(result) {
            if (result.status === 'notfound') {
              apos.notify('That page does not exist.', { type: 'error' });
              return callback('error');
            } else if (result.status !== 'ok') {
              apos.notify('An error occurred. Please try again.', { type: 'error' });
              return callback('error');
            }
            self.schema = result.schema;
            // Accept defaults for fields custom to the
            // new page type without overwriting values
            // already entered for existing fields
            _.each(result.data, function(val, key) {
              if (!_.has(page, key)) {
                page[key] = val;
              }
            });
            return callback(null);
          }, function() {
            return callback('network');
          });
        },
        editor: function(callback) {
          return self.html('editor', { id: self.page._id, type: type, verb: self.verb }, function(html) {
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
        apos.ui.globalBusy(false);
        if (err) {
          apos.notify('An error occurred. Please try again.', { type: 'error' });
          return;
        }
        apos.emit('enhance', self.$el.find('[data-page-schema-fields]'));
        self.addTypeChangeHandler();
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
