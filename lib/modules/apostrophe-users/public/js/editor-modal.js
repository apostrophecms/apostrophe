// Edit or create a user. Extends the piece editor to suggest full names based on the
// first and last name, suggest usernames based on the full name, and require a password
// when creating a new user.

apos.define('apostrophe-users-editor-modal', {

  extend: 'apostrophe-pieces-editor-modal',

  construct: function(self, options) {

    var superBeforeShow = self.beforeShow;
    self.beforeShow = function(callback) {
      self.requirePasswordWhenCreating();
      return superBeforeShow(function(err) {
        if (err) {
          return callback(err);
        }
        self.enableTitleViaName();
        self.enableUsernameViaTitle();
        return callback(null);
      });
    };

    self.requirePasswordWhenCreating = function() {
      if (!self.options.create) {
        return;
      }

      // Clone deep enough that we can tamper with `required` without
      // affecting subsequent edit modals
      self.schema = _.map(self.schema, _.clone);

      var password = _.find(self.schema, { name: 'password' });
      if (!password) {
        return;
      }
      password.required = true;
    };

    self.enableTitleViaName = function() {
      self.$title = apos.schemas.findField(self.$el, 'title');
      self.$firstName = apos.schemas.findField(self.$el, 'firstName');
      self.$lastName = apos.schemas.findField(self.$el, 'lastName');
      self.$firstName.on('change', self.updateTitleViaName);
      self.$lastName.on('change', self.updateTitleViaName);
    };

    self.updateTitleViaName = function() {
      self.$title.val((self.$firstName.val() + ' ' + self.$lastName.val()).trim());
      // So the slug can also get updated by its event handlers, etc.
      self.$title.trigger('change');
      self.$title.trigger('textchange');
    };

    self.enableUsernameViaTitle = function() {
      self.$username = apos.schemas.findField(self.$el, 'username');
      self.$title.on('change', self.updateUsernameViaTitle);
    };

    self.updateUsernameViaTitle = function() {
      if ((!self.options.create) && self.$username.val().length) {
        return;
      }
      var username = apos.utils.slugify(self.$title.val());
      self.updateUsernameViaTitleAttempt(username);
    };

    self.updateUsernameViaTitleAttempt = function(username) {
      return self.api('unique-username', { username: username }, function(data) {
        if (data.status !== 'ok') {
          return;
        }
        if (!data.available) {
          return self.updateUsernameViaTitleAttempt(username + Math.floor(Math.random() * 10));
        }
        self.$username.val(username);
      });
    };

    var superDisplayError = self.displayError;
    self.displayError = function(result) {
      if (result.status === 'rules') {
        var error = apos.schemas.error(_.find(self.schema, { name: 'password' }), 'rules');
        error.message = result.messages.join(', ');
        apos.schemas.showError(self.$form, error);
        apos.schemas.scrollToError(self.$form);
      } else {
        return superDisplayError(result);
      }
    };

    self.getErrorMessage = function(err) {
      if (err === 'unique') {
        return 'Please make sure the username and email address fields are unique.';
      }
      return 'An error occurred. Please try again.';
    };

  }
});
