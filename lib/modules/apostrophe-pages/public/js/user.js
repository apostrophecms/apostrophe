// This singleton provides jquery event handlers to trigger various operations
// on pages, such as insert, update, reorganize and trash. Most of the logic
// lies elsewhere in modals for those particular tasks.

apos.define('apostrophe-pages', {

  extend: 'apostrophe-doc-type-manager',

  beforeConstruct: function(self, options) {
    self.options = options;
    self.page = self.options.page;
  },

  afterConstruct: function(self) {
    self.addLinks();
  },

  construct: function(self) {
    self.addLinks = function() {
      apos.ui.link('apos-insert', 'page', function() {
        apos.create('apostrophe-pages-editor', { action: self.options.action });
      });
      apos.ui.link('apos-copy', 'page', function() {
        apos.create('apostrophe-pages-editor-copy', { action: self.options.action });
      });
      apos.ui.link('apos-update', 'page', function() {
        self.pageSettings();
      });
      apos.ui.link('apos-reorganize', 'page', function() {
        self.reorganize();
      });
      apos.adminBar.link(self.__meta.name, function() {
        self.reorganize();
      });
      apos.ui.link('apos-trash', 'page', function() {
        self.trash(self.page._id, function(err, parentSlug, changed) {
          if (err) {
            apos.notify('A server error occurred.', { type: 'error', dismiss: true });
          } else {
            apos.ui.redirect(parentSlug);
          }
        });
      });
      apos.ui.link('apos-publish', 'page', function() {
        // fetch the page
        return self.api('fetch-to-update', { _id: self.page._id, type: self.page.type }, function(result) {
          if (result.status !== 'ok') {
            return apos.notify('An error occurred while publishing the page: ' + result.status, { type: 'error' });
          }
          // set to published
          result.data.published = true;
          return self.api('update', { currentPageId: self.page._id, page: result.data }, function(data) {
            if (data.status !== 'ok') {
              return apos.notify('An error occurred while publishing the page: ' + data.status, { type: 'error' });
            }
            // Go to the new page
            window.location.href = data.url;
          });
        });
      });
    };

    // page settings for current page
    self.pageSettings = function(options) {
      apos.create('apostrophe-pages-editor-update', _.merge({}, options || {}, { action: self.options.action }));
    };

    // Display UI permitting the user to reorganize the page tree

    self.reorganize = function() {
      apos.create('apostrophe-pages-reorganize',
        _.pick(self.options, 'action', 'deleteFromTrash', 'trashInSchema', 'batchOperations')
      );
    };

    // options.chooser is required

    self.chooserModal = function(options) {
      return apos.create('apostrophe-pages-reorganize',
        _.assign(
          {
            source: 'chooser-modal'
          },
          options,
          _.pick(self.options, 'action', 'deleteFromTrash', 'trashInSchema')
        )
      );
    };

    self.trash = function(_id, callback) {
      self.api('move-to-trash', { _id: _id }, function(data) {
        if (data.status === 'ok') {
          return callback(null, data.parentSlug, data.changed);
        }
        return callback(data.status);
      }, function() {
        return callback('network');
      });
    };

    // Rescue a page from the trash. Currently invoked
    // only when trashInSchema option is true
    self.rescue = function(_id, callback) {
      self.api('rescue-from-trash', { _id: _id }, function(data) {
        if (data.status === 'ok') {
          return callback(null, data.parentSlug, data.changed);
        }
        return callback(data.status);
      }, function() {
        return callback('network');
      });
    };

    // Irrevocably delete something from the trash
    self.deleteFromTrash = function(_id, callback) {
      self.api('delete-from-trash', { _id: _id }, function(data) {
        if (data.status === 'ok') {
          return callback(null, data.parentSlug);
        }
        return callback(data.status);
      }, function() {
        return callback('network');
      });
    };

    apos.pages = self;
  }
});
