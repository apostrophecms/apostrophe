apos.define('apostrophe-login', {
  afterConstruct: function() {
    self.enableResetKnownPassword();
  },
  construct: function(self, options) {
    self.resetKnownPassword = function() {
      return apos.create('apostrophe-reset-known-password-modal', self.options);
    };
    self.enableResetKnownPassword = function() {
      apos.toolbar.link('apostrophe-login-reset-known-password', self.resetKnownPassword);
    };
  }
});
