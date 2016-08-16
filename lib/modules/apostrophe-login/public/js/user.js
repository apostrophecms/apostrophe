apos.define('apostrophe-login', {
  afterConstruct: function(self) {
    self.enableClickHandlers();
  },
  construct: function(self, options) {
    self.enableClickHandlers = function() {
      apos.adminBar.link(self.__meta.name + '-logout', function() {
        window.location.href = apos.prefix + '/logout';
      });
    };
  }
});
