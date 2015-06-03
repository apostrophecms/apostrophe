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

    self.managerName = self.name + '-manager';
    self.editorName = self.name + '-editor';

    self.manage = function() {
      apos.create(self.managerName, options);
    };

    self.edit = function() {
      apos.create(self.editorName, options);
    };

    self.create = function() {
      apos.create(self.creatorName, options);
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

apos.define('apostrophe-pieces-manager', {
  extend: 'apostrophe-modal',
  source: 'manager',
  construct: function(self, options) {
    self.name = self.options.name;
    self.page = 1;
    options.source = 'manage';
    self.beforeShow = function(callback) {
      self.$list = $el.find('[data-list]');
      self.$itemTemplate = $el.find('[data-list] [data-item]');
      self.$itemTemplate.remove();
      self.clickHandlers();
      self.refresh();
    };
    self.refresh = function() {
      $.jsonCall(self.options.action + '/list', {
        format: 'manage',
        page: self.page
      }, function(html) {
        self.$list.html(html);
      }, 'html');
    };
  }
});

apos.define('apostrophe-pieces-editor', {
});

