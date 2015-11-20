apos.define('apostrophe-docs', {
  beforeConstruct: function(self, options) {
    self.options = options;
    self.action = options.action;
  },
  construct: function(self, options) {
    self.managers = {};

    self.getManagerType = function(type) {
      return type + '-manager';
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
