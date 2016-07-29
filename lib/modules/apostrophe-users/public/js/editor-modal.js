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
      self.schema = _.clone(self.schema);
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

  }
});

