apos.define('apostrophe-pieces', {

  extend: 'apostrophe-docs-manager',

  afterConstruct: function(self) {
    self.clickHandlers();
    self.defineTools();
    apos.docs.setManager(self.name, self);
  },

  construct: function(self, options) {

    self.options = options;
    self.name = self.options.name;

    self.clickHandlers = function() {
      apos.ui.link('manage', self.name, function() {
        self.manage();
      });
      apos.ui.link('edit', self.name, function($button, _id) {
        self.edit(_id);
      });
      apos.ui.link('create', self.name, function($button) {
        self.create();
      });
    };

    self.manage = function() {
      return self.getTool('manager-modal');
    };

    self.edit = function(_id) {
      return self.getTool('editor-modal', { _id: _id });
    };

    self.create = function() {
      return self.getTool('editor-modal');
    };

    // If our inheritance tree looks like:
    //
    // pieces: events: nifty-events
    //
    // Then make sure that this tree also exists:
    //
    // pieces-manager-modal: events-manager-modal: nifty-events-manager-modal
    //
    // The developer may then take advantage of moog's
    // implicit subclassing feature to extend any
    // of these.

    self.defineTools = function() {
      var tools = [ 'manager', 'editor-modal', 'manager-modal' ];
      _.each(tools, function(tool) {
        apos.mirror(self.__meta, '-' + tool);
      });
    };

  }
});


