apos.define('apostrophe-docs-manager', {
  beforeConstruct: function(self, options) {
    self.options = options;
    self.type = options.type;
  },
  construct: function(self, options) {
    self.getChooserType = function() {
      // If this is a subclass of apostrophe-docs-manager, do our best
      // to find a chooser with the same name pattern
      var type = self.__meta.name.replace('-manager', '-chooser');
      if (!apos.isDefined(type)) {
        // Nope, so just use apostrophe-docs-chooser
        type = 'apostrophe-docs-chooser';
      }
      return type;
    };
    self.getChooser = function(options) {
      return apos.create(type, options);
    };
  }
});
