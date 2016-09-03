apos.define('apostrophe-docs', {
  beforeConstruct: function(self, options) {
    self.options = options;
    self.action = options.action;
  },
  construct: function(self, options) {
    self.managers = {};

    self.getManager = function(type) {
      return self.managers[type];
    };

    self.setManager = function(type, manager) {
      self.managers[type] = manager;
    };

    apos.docs = self;
  }
});
