apos.define('apostrophe-login', {
  afterConstruct: function(self) {
    self.enableResetKnownPassword();
  },
  construct: function(self, options) {
    self.resetKnownPassword = function() {
      return apos.create('apostrophe-reset-known-password-modal', options);
    };
    self.enableResetKnownPassword = function() {
      apos.adminBar.link('apostrophe-login-reset-known-password', self.resetKnownPassword);
    };
  }
});
