// A modal for exporting the changes in a given commit to other locales

apos.define('apostrophe-reset-known-password-modal', {

  extend: 'apostrophe-modal',

  source: 'reset-known-password-modal',

  construct: function(self, options) {

    self.saveContent = function(callback) {
      var $serverSideError = self.$el.find('[data-server-side-error]');
      $serverSideError.hide();
      self.$el.find('[data-field]').removeClass('apos-error');
      if (!self.$el.findByName('existing-password').val().length) {
        self.$el.find('[data-field="existing-password"]').addClass('apos-error');
        return callback('error');
      }
      if (!self.$el.findByName('new-password').val().length) {
        self.$el.find('[data-field="new-password"]').addClass('apos-error');
        return callback('error');
      }
      if (self.$el.findByName('new-password').val() !== self.$el.findByName('new-password-confirm').val()) {
        self.$el.find('[data-field="new-password-confirm"]').addClass('apos-error');
        return callback('error');
      }
      apos.ui.globalBusy(true);
      return self.api('reset-known-password', {
        existingPassword: self.$el.findByName('existing-password').val(),
        newPassword: self.$el.findByName('new-password').val(),
        newPasswordConfirm: self.$el.findByName('new-password-confirm').val()
      }, function(result) {
        apos.ui.globalBusy(false);
        if (result.status === 'ok') {
          return callback(null);
        } else if (result.status === 'rules') {
          $serverSideError.text(result.messages.join(' '));
          $serverSideError.show();
          self.$el.find('[data-field="new-password"]').addClass('apos-error');
          return callback('error');
        } else {
          self.$el.find('[data-field="existing-password"]').addClass('apos-error');
          return callback('error');
        }
      }, function(err) {
        self.apos.utils.error(err);
        $serverSideError.text('A network error occurred. Please try again.');
        $serverSideError.show();
        return callback('error');
      });
    };
  }
});
