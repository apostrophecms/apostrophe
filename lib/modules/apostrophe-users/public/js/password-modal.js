apos.define('apostrophe-users-password-modal', {
  extend: 'apostrophe-modal',
  source: 'password-modal',
  construct: function(self, options) {
    self.beforeShow = function(callback) {
      return callback(null);
    };
    self.saveContent = function(callback) {
      var existing = self.$el.findByName('current-password');
      var val1 = self.$el.findByName('password');
      var val2 = self.$el.findByName('confirm-password');
      if (!existing.length) {
        return apos.notify('You must enter your existing password. If you have forgotten it, use "Forgot Password" on the login page.');
      if (!val1.length) {
        apos.notify('Please enter a new password and click Save, or click Cancel.', { type: 'error' });
        return callback('invalid');
      } else if (!val2.length) {
        apos.notify('You must confirm your password.', { type: 'error' });
        return callback('invalid');
      } else if (val1 !== val2) {
        apos.notify('Passwords must match.', { type: 'error' });
        return callback('invalid');
      } 
      return self.api('password', {
        password: val1
      }, function(result) {
        if (result.status !== 'ok') {
          return fail();
        } else {
          apos.notify('Password updated.', { type: 'success' });
        }
      }, function() {
        return fail();
      });
      function fail() {
        apos.notify('An error occurred while updating your password.', { type: 'error' });
        return callback('invalid');
      }
    }
  }
});
