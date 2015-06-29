apos.define('apostrophe-pages', {
  beforeConstruct: function(self, options) {
    self.options = options;
  },
  afterConstruct: function(self) {
    $('body').on('click', '[data-new-page]', function() {
      apos.create('apostrophe-pages-new', self.options);
    });
  }
});
