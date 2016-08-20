apos.define('apostrophe-pieces', {

  extend: 'apostrophe-doc-type-manager',

  afterConstruct: function(self) {
    self.clickHandlers();
  },

  construct: function(self, options) {

    self.options = options;
    self.name = self.options.name;

    self.clickHandlers = function() {
      apos.adminBar.link(self.__meta.name, function() {
        self.manage();
      });
      // The rest of these are not part of the admin bar, follow our own convention
      apos.ui.link('apos-edit', self.name, function($button, _id) {
        self.edit(_id);
      });
      apos.ui.link('apos-rescue', self.name, function($button, _id) {
        self.rescue(_id);
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
      apos.ui.link('apos-versions', self.name, function($button) {
        var id = $button.attr('data-apos-versions-' + self.name);
        apos.create('apostrophe-versions-editor', {
          action: '/modules/apostrophe-versions',
          _id: id,
          afterRevert: function() {
            window.location.reload(true);
          }
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
      return self.getTool('editor-modal', { create: true });
    };

    self.rescue = function(_id) {
      if (self.rescuing) {
        return;
      }
      self.rescuing = true;
      apos.ui.globalBusy(true);
      self.api('rescue', { _id: _id }, function(result) {
        self.rescuing = false;
        apos.ui.globalBusy(false);
        if (result.status !== 'ok') {
          alert('An error occurred. Please try again.');
          return;
        } else {
          alert('That item has been rescued from the trash.');
        }
        apos.change(self.name);
      }, function() {
        self.rescuing = false;
        apos.ui.globalBusy(false);
        alert('An error occurred. Please try again');
        return;
      });
    };
  }
});
