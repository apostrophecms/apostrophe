// The browser-side doc type manager for a type of piece. Provides jQuery event handlers
// for edit, rescue, create and version rollback based on data attributes that can
// appear anywhere, which is useful for contextual pieces.

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
      apos.ui.link('apos-manage', self.name, function($button, _id) {
        self.manage();
      });
      apos.ui.link('apos-edit', self.name, function($button, _id) {
        self.edit(_id);
      });
      apos.ui.link('apos-rescue', self.name, function($button, _id) {
        self.rescue(_id);
      });
      apos.ui.link('apos-create', self.name, function($button) {
        self.create();
      });
      apos.ui.link('apos-publish', self.name, function($button, id) {
        var piece = { _id: id };
        self.api('publish', piece, function(data) {
          if (data.status !== 'ok') {
            return apos.notify('An error occurred while publishing the page: ' + data.status, { type: 'error' });
          }
          // Go to the new page
          window.location.reload(true);
        });
      });
      apos.ui.link('apos-versions', self.name, function($button, id) {
        apos.versions.edit(id, function() {
          apos.change(self.name);
        });
      });
      apos.ui.link('apos-trash', self.name, function($button, id) {
        if (!confirm("Are you sure you want to trash this " + self.options.label + "?")) {
          return;
        }

        var piece = {
          _id: id
        };

        apos.ui.globalBusy(true);

        return self.api('trash', piece, function(result) {
          apos.ui.globalBusy(false);
          if (result.status !== 'ok') {
            apos.notify('An error occurred. Please try again.', { type: 'error', dismiss: true });
            return;
          }
          window.location.href = apos.pages.page._url;
        }, function() {
          apos.ui.globalBusy(false);
          apos.notify('An error occurred. Please try again.', { type: 'error', dismiss: true });

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
          apos.notify('An error occurred. Please try again.', { type: 'error', dismiss: true });
          return;
        } else {
          apos.notify('That item has been rescued from the trash.', { type: 'success', dismiss: 3 });
        }
        apos.change(self.name);
      }, function() {
        self.rescuing = false;
        apos.ui.globalBusy(false);
        apos.notify('An error occurred. Please try again', { type: 'error', dismiss: true });

      });
    };
  }
});
