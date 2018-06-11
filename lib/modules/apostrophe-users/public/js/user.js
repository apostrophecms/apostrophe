apos.define('apostrophe-users', {
  extend: 'apostrophe-pieces',

  construct: function(self, options) {
    var superClickHandlers = self.clickHandlers;
    self.clickHandlers = function() {
      superClickHandlers();
      $('body').on('click', '[data-apos-logout]', function() {
        document.location.href = apos.prefix + '/logout';
      });
    };
  }
});
