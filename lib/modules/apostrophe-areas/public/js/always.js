apos.define('apostrophe-areas', {

  afterConstruct: function(self) {
    self.enablePlayers();
    // make ourselves accessible so widget managers
    // can register themselves
    apos.areas = self;
  },

  construct: function(self, options) {

    self.options = options;

    self.widgetManagers = {};

    self.setWidgetManager = function(name, manager) {
      self.widgetManagers[name] = manager;
    };

    self.getWidgetManager = function(name) {
      return self.widgetManagers[name];
    }

    self.enablePlayers = function() {
      apos.on('enhance', function($el) {

        $el.find('[data-widget]').each(function() {
          var $widget = $(this);
          if ($widget.data('alreadyPlayed')) {
            return;
          }
          var data = self.getWidgetData($widget);
          var options = self.getWidgetOptions($widget);

          var manager = self.getWidgetManager($widget.attr('data-widget'));
          if (manager && manager.play) {
            manager.play($widget, data, options);
          }

          $widget.data('alreadyPlayed', true);
        });

      });

    };

    self.getWidgetOptions = function($widget) {
      return JSON.parse($widget.attr('data-options') || '{}');
    };

    self.getWidgetData = function($widget) {
      var manager = self.getWidgetManager($widget.attr('data-widget'));
      return manager.getData($widget);
    };

  }
});
