apos.define('apostrophe-tags', {
  extend: 'apostrophe-context',
  afterConstruct: function(self) {
    self.enableClickHandlers();
  },
  construct: function(self, options) {
    self.enableClickHandlers = function() {
      apos.adminBar.link('apostrophe-tags', function() {
        self.manage();
      });
    };

    self.manage = function() {
      apos.create('apostrophe-tags-manager-modal', options);
    };
  }
});
