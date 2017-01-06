apos.define('apostrophe-global', {
  extend: 'apostrophe-doc-type-manager',

  afterConstruct: function(self) {
    self.addClickHandlers();
  },

  beforeConstruct: function(self, options) {
    self.options = options;
  },

  construct: function(self, options) {
    
    self._id = self.options._id;

    self.addClickHandlers = function() {
      apos.ui.link('apos-versions', 'global', function($button) {
        apos.versions.edit(self._id);
      });
    };

  }
});
