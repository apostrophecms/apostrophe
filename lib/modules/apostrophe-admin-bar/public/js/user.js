apos.define('apostrophe-admin-bar', {
  construct: function(self, options) {
    // When the specified admin bar item is clicked, call the specified function
    self.link = function(name, callback) {
      return $('body').on('click', '[data-apos-admin-bar-item="' + name + '"]', function() {
        callback();
        return false;
      });
    }
    apos.adminBar = self;
  }
});
