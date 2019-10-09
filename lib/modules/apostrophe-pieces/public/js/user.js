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

    // Globally link up clicks on data-apos-${action} where the piece
    // type name is made properly attribute-name-friendly
    self.globalLink = function(action, fn) {
      apos.ui.link(action, apos.utils.cssName(self.name), fn);
    };

    self.clickHandlers = function() {
      apos.adminBar.link(self.__meta.name, function() {
        self.manage();
      });
      // The rest of these are not part of the admin bar, follow our own convention
      self.globalLink('apos-manage', function($button, _id) {
        self.manage();
      });
      self.globalLink('apos-edit', function($button, _id) {
        var hint = $button.attr('data-apos-edit-hint');
        self.edit(_id, { hint: hint });
      });
      self.globalLink('apos-rescue', function($button, _id) {
        self.rescue(_id);
      });
      self.globalLink('apos-create', function($button) {
        self.create();
      });
      self.globalLink('apos-publish', function($button, id) {
        var piece = { _id: id };
        self.api('publish', piece, function(data) {
          if (data.status !== 'ok') {
            return apos.notify('An error occurred while publishing the page: ' + data.status, { type: 'error' });
          }
          // Go to the new page
          window.location.reload(true);
        });
      });
      self.globalLink('apos-versions', function($button, id) {
        apos.versions.edit(id, function() {
          apos.change(self.name);
        });
      });
      self.globalLink('apos-trash', function($button, id) {
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

    // `options` object is merged with the options passed to the editor modal,
    // in particular you can pass a `hint` to be displayed
    // at the top of the modal to provide context for why the edit operation
    // was undertaken

    self.edit = function(_id, options) {
      return self.getTool('editor-modal', _.merge({}, options || {}, { _id: _id }));
    };

    // `options` object is merged with the options passed to the editor modal,
    // in particular you can pass a `hint` to be displayed
    // at the top of the modal to provide context for why the edit operation
    // was undertaken
    self.create = function(options) {
      return self.getTool('editor-modal', _.merge({}, options || {}, { create: true }));
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

    self.launchBatchPermissionsModal = function(data, callback) {
      return apos.create('apostrophe-pieces-batch-permissions-modal',
        _.assign({}, self.options, {
          schema: self.options.batchPermissionsSchema,
          manager: self,
          body: data,
          after: callback
        })
      );
    };

  }
});
