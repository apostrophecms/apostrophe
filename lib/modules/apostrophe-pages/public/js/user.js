apos.define('apostrophe-pages', {

  extend: 'apostrophe-docs-manager',

  beforeConstruct: function(self, options) {
    self.options = options;
  },

  afterConstruct: function(self) {
    self.addLinks();
    // Set ourselves up as the manager for the "apostrophe-page" type, a virtual type used
    // when we want a join that can select any page in the tree
    apos.docs.setManager('apostrophe-page', self);
  },

  construct: function(self) {
    self.addLinks = function() {
      apos.ui.link('apos-insert', 'page', function() {
        apos.create('apostrophe-pages-editor', { action: self.options.action });
      });
      apos.ui.link('apos-update', 'page', function() {
        apos.create('apostrophe-pages-editor-update', { action: self.options.action });
      });
      apos.ui.link('apos-reorganize', 'page', function() {
        apos.create('apostrophe-pages-reorganize', { action: self.options.action });
      });
      apos.ui.link('apos-trash', 'page', function() {
        self.trash(self.page._id, function(err, parentSlug, changed) {
          if (err) {
            alert('A server error occurred.');
          } else {
            apos.ui.redirect(parentSlug);
          }
        });
      });
      apos.ui.link('apos-publish', 'page', function() {
        // fetch the page
        return self.api('fetch-to-update', { _id: self.page._id, type: self.page.type }, function(result) {
          if (result.status !== 'ok') {
            return alert('An error occurred while publishing the page: ' + result.status);
          }
          // set to published
          result.data.published = true;
          return self.api('update', { currentPageId: self.page._id, page: result.data }, function(data) {
            if (data.status !== 'ok') {
              return alert('An error occurred while publishing the page: ' + data.status);
            }
            // Go to the new page
            window.location.href = data.url;
          });
        });
      });
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

    self.setPage = function(page) {
      self.page = page;
    };

    apos.pages = self;
  }
});
