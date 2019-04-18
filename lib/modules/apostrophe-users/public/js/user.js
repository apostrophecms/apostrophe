apos.define('apostrophe-users', {
  extend: 'apostrophe-pieces',

  construct: function(self, options) {
    var superClickHandlers = self.clickHandlers;
    self.clickHandlers = function() {
      superClickHandlers();
      $('body').on('click', '[data-apos-logout]', function() {
        document.location.href = apos.prefix + '/logout';
      });
      $('body').on('click', '[data-apos-admin-bar-item="apostrophe-change-password"]', function() {
        apos.create('apostrophe-users-change-password-modal', options);
      });
    };
  }
});
