apos.define('apostrophe-versions', {

  extend: 'apostrophe-context',

  beforeConstruct: function(self, options) {
    self.options = options;
  },

  afterConstruct: function(self) {
    self.addLinks();
  },

  construct: function(self) {
    self.addLinks = function() {
      apos.ui.link('versions', 'page', function() {
        apos.create('apostrophe-versions-editor', { action: self.action, page: apos.pages.options.page });
      });
    };

    apos.versions = self;
  }
});
