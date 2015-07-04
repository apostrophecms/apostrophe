apos.define('apostrophe-pages', {
  beforeConstruct: function(self, options) {
    self.options = options;
  },
  afterConstruct: function(self) {
    apos.log('calling addLinks');
    self.addLinks();
  },
  construct: function(self) {
    self.addLinks = function() {
      apos.utils.link('insert', 'page', function() {
        apos.log('fired');
        apos.create('apostrophe-pages-editor', { action: self.options.action });
      });
      apos.utils.link('update', 'page', function() {
        apos.create('apostrophe-pages-editor-update', { action: self.options.action });
      });
    };
    apos.pages = self;
  }
});
