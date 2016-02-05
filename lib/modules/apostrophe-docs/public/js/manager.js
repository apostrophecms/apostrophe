apos.define('apostrophe-docs-manager', {

  beforeConstruct: function(self, options) {
    self.options = options;
    self.type = options.type;
  },

  construct: function(self, options) {

    // Fetch a related tool such as the chooser, manager-modal or editor-modal for this type.
    //
    // Return false if no such tool is available.
    //
    // Options are merged with the options of this manager.
    //
    // Callback argument can be omitted if this tool doesn't require a callback for
    // constructing new instances.

    self.getTool = function(name, options, callback) {
      var _options = _.clone(self.options);
      _.assign(_options, options);
      var type = self.getToolType(name);
      if (!type) {
        return false;
      }
      if (!callback) {
        return apos.create(self.getToolType(name), _options);
      }
      return apos.create(self.getToolType(name), _options, callback);
    };

    // Figure out the moog type name for a related tool such as the chooser, manager-modal
    // or editor for this type. First try replacing -manager with -name in the type name
    // of this manager object. If that doesn't work, look for a generic implementation
    // as apostrophe-docs-name. If that doesn't work, return false.

    self.getToolType = function(name) {
      var type = self.__meta.name.replace(/\-manager$/, '') + '-' + name;
      console.log(type);
      if (!apos.isDefined(type)) {
        // Generic one available?
        type = 'apostrophe-docs-' + name;
        if (!apos.isDefined(type)) {
          return false;
        }
      }
      return type;
    };

  }
});
