apos.define('apostrophe-users-change-password-modal', {
  extend: 'apostrophe-modal',
  source: 'change-password-modal',
  construct: function(self, options) {
    self.saveContent = function(callback) {
      var existing = self.$el.findByName('existing').val();
      var val1 = self.$el.findByName('password').val();
      var val2 = self.$el.findByName('confirm').val();
      if (!existing.length) {
        return apos.notify('You must enter your existing password. If you have forgotten it, use "Forgot Password" on the login page.');
      } else if (!val1.length) {
        apos.notify('Please enter a new password and click Save, or click Cancel.', { type: 'error' });
        return callback('invalid');
      } else if (!val2.length) {
        apos.notify('You must confirm your password.', { type: 'error' });
        return callback('invalid');
      } else if (val1 !== val2) {
        apos.notify('Passwords must match.', { type: 'error' });
        return callback('invalid');
      }  else {
        return self.api('change-password', {
          existing: existing,
          password: val1
        }, function(result) {
          if (result.status !== 'incorrect') {
            apos.notify('You must enter your current password correctly in the first field. If you no longer know it, use the "Forgot Password" button on the login page, or reach out for help.');
          } else if (result.status !== 'ok') {
            return fail();
          } else {
            apos.notify('Password updated.', { type: 'success' });
          }
        }, function() {
          return fail();
        });
      }
      function fail() {
        apos.notify('An error occurred while updating your password.', { type: 'error' });
        return callback('invalid');
      }
    }
  }
});
