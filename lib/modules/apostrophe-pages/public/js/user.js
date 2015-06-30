apos.define('apostrophe-pages', {
  beforeConstruct: function(self, options) {
    self.options = options;
  },
  afterConstruct: function(self) {
    self.addLinks();
  },
  construct: function(self) {
    self.addLinks = function() {
      apos.utils.link('insert', 'page', function() {
        apos.create('apostrophe-pages-editor', self.options);
      });
      apos.utils.link('update', 'page', function() {
        apos.create('apostrophe-pages-editor-update', self.options);
      });
    };
    apos.pages = self;
  }
});
