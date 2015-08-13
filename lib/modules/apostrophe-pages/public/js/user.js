apos.define('apostrophe-pages', {
  beforeConstruct: function(self, options) {
    self.options = options;
  },
  afterConstruct: function(self) {
    self.addLinks();
  },
  construct: function(self) {
    self.addLinks = function() {
      apos.ui.link('insert', 'page', function() {
        apos.log('fired');
        apos.create('apostrophe-pages-editor', { action: self.options.action });
      });
      apos.ui.link('update', 'page', function() {
        apos.create('apostrophe-pages-editor-update', { action: self.options.action });
      });
      apos.ui.link('reorganize', 'page', function() {
        apos.create('apostrophe-pages-reorganize', { action: self.options.action });
      });
    };
    apos.pages = self;
  }
});
