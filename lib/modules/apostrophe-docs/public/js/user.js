apos.define('apostrophe-docs', {
  beforeConstruct: function(self, options) {
    self.options = options;
  },
  construct: function(self, options) {
    self.managers = {};
    self.getManager = function(type) {
      if (self.managers[type]) {
        return self.managers[type];
      }
      self.managers[type] = apos.create('apostrophe-docs-manager', { type: type, action: self.options.action });
      return self.managers[type];
    };
    self.setManager = function(type, manager) {
      self.managers[type] = manager;
    };
    apos.docs = self;
  }
});
