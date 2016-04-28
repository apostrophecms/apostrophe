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
      apos.ui.link('apos-manage', self.name, function() {
        self.manage();
      });
      apos.ui.link('apos-edit', self.name, function($button, _id) {
        self.edit(_id);
      });
      apos.ui.link('apos-create', self.name, function($button) {
        self.create();
      });
      apos.ui.link('apos-publish', self.name, function($button) {
        var id = $button.attr('data-apos-publish-' + self.name);
        var piece = { _id: id };
        self.api('publish', piece, function(data) {
          if (data.status !== 'ok') {
            return alert('An error occurred while publishing the page: ' + data.status);
          }
          // Go to the new page
          location.reload();
        });
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
