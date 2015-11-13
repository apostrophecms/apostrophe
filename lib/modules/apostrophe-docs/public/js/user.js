apos.define('apostrophe-docs', {
  beforeConstruct: function(self, options) {
    self.options = options;
  },
  construct: function(self, options) {
    self.managers = {};

    self.getManagerType = function(type) {
      var type = type + '-manager';
      if (!apos.isDefined(type)) {
        // Nope, so just use apostrophe-docs-manager
        type = 'apostrophe-docs-manager';
      }
      return type;
    };

    self.getManager = function(type) {
      if (self.managers[type]) {
        return self.managers[type];
      }
      self.managers[type] = apos.create(self.getManagerType(type), { type: type, action: self.options.action });
      return self.managers[type];
    };

    self.setManager = function(type, manager) {
      self.managers[type] = manager;
    };

    apos.docs = self;
  }
});
