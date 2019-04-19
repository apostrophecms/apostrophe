module.exports = {
  afterConstruct: function(self) {
    self.enableMiddleware();
  },
  construct: function(self, options) {
    self.enableMiddleware = function () {
      // Angular-style CSRF protection. See also the
      // apostrophe-express csrf.exceptions option. -Tom
      if (self.options.csrf !== false) {
        self.expressMiddleware = self.apos.modules['apostrophe-express'].csrf;
      }
    };
  }
};
