apos.define('apostrophe-pages', {

  extend: 'apostrophe-context',

  beforeConstruct: function(self, options) {
    self.options = options;
  },

  afterConstruct: function(self) {
    self.addLinks();
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
        self.trash(self.options.page._id, function(err, parentSlug, changed) {
          if (err) {
            alert('A server error occurred.');
          } else {
            apos.ui.redirect(parentSlug);
          }
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

    apos.pages = self;
  }
});
