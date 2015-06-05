apos.define('apostrophe-pieces', {

  afterConstruct: function(self) {
    self.clickHandlers();
    self.defineTools();
  },

  construct: function(self, options) {

    self.options = options;
    self.name = self.options.name;

    self.clickHandlers = function() {
      apos.utils.action('manage', self.name, function() {
        self.manage();
      });
      apos.utils.action('edit', self.name, function(id) {
        self.edit(id);
      });
      apos.utils.action('create', self.name, function(id) {
        self.create(id);
      });
    };

    self.managerName = self.__meta.name + '-manager';
    self.editorName = self.__meta.name + '-editor';

    self.getToolOptions = function(extend) {
      var options = _.omit(self.options, 'construct', 'beforeConstruct', 'afterConstruct');
      _.extend(options, extend || {});
      return options;
    };

    self.manage = function() {
      apos.create(self.managerName, self.getToolOptions());
    };

    self.edit = function($button, _id) {
      console.log(arguments);
      apos.create(self.editorName, self.getToolOptions({ _id: _id }));
    };

    self.create = function() {
      apos.create(self.editorName, self.getToolOptions());
    };

    // If our inheritance tree looks like:
    //
    // pieces: events: nifty-events
    //
    // Then make sure that this tree also exists:
    //
    // pieces-manager: events-manager: nifty-events-manager
    //
    // The developer may then take advantage of moog's
    // implicit subclassing feature to extend any
    // of these.

    self.defineTools = function() {
      var tools = [ 'manager', 'editor' ];
      _.each(tools, function(tool) {
        apos.mirror(self.__meta, tool);
      });
    };

  }
});


