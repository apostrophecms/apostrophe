apos.define('apostrophe-pieces', {

  extend: 'apostrophe-docs-manager',

  afterConstruct: function(self) {
    self.clickHandlers();
    apos.docs.setManager(self.name, self);
  },

  construct: function(self, options) {

    self.options = options;
    self.name = self.options.name;

    self.clickHandlers = function() {
      apos.ui.link('manage', self.name, function() {
        self.manage();
      });
      apos.ui.link('edit', self.name, function($button, _id) {
        self.edit(_id);
      });
      apos.ui.link('create', self.name, function($button) {
        self.create();
      });
    };

    self.manage = function() {
      return self.getTool('manager-modal');
    };

    self.edit = function(_id) {
      return self.getTool('editor-modal', { _id: _id });
    };

    self.create = function() {
      return self.getTool('create-modal');
    };

  }
});
