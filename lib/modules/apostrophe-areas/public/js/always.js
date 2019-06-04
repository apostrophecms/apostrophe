apos.define('apostrophe-areas', {

  afterConstruct: function(self) {
    if (!apos.assets.options.lean) {
      // Not in strictly lean mode so we offer the classic widget players
      self.enablePlayers();
    }
  },

  construct: function(self, options) {

    self.options = options;

    self.widgetManagers = {};

    // Called by subclasses of `apostrophe-widgets`. The `manager`
    // object must provide, at a minimum, `setData`, `getData` and
    // `play` methods. See `always.js` and `user.js` in the
    // `apostrophe-widgets` module for examples. Normally you
    // will extend `apostrophe-widgets` and this will be invoked
    // for you.

    self.setWidgetManager = function(name, manager) {
      self.widgetManagers[name] = manager;
    };

    // Fetch the manager object for the given widget type name.

    self.getWidgetManager = function(name) {
      return self.widgetManagers[name];
    };

    // Ensure that the `play` method of the manager for every
    // widget is invoked, if it exists, every time new widgets are
    // present in the page. Adds a handler for the `enhance`
    // Apostrophe event, which is triggered both on page load and
    // any time new content is rendered into the page during editing.
    // The `play` method will receive the widget's jQuery element,
    // the widget's data and the configured options for that
    // widget type.

    self.enablePlayers = function() {

      apos.on('enhance', function($el) {

        $el.find('[data-apos-widget]').each(enhance);
        // Also works if $el itself is a widget
        $el.filter('[data-apos-widget]').each(enhance);

        function enhance() {
          var $widget = $(this);
          if ($widget.data('alreadyPlayed')) {
            return;
          }
          var data = self.getWidgetData($widget);
          var options = self.getWidgetOptions($widget);

          var type = $widget.attr('data-apos-widget');
          if (apos.utils.widgetPlayers[type]) {
            // If a lean player is present, it always wins, so we
            // can progressively migrate to lean mode before
            // setting `lean: true` for `apostrophe-assets` to completely
            // disable the classic frontend js players and libraries
            return;
          }
          var manager = self.getWidgetManager($widget.attr('data-apos-widget'));
          if (manager && manager.play) {
            manager.play($widget, data, options);
          }

          $widget.data('alreadyPlayed', true);
        }
      });

    };

    // Fetch the configured options for the specified
    // `$widget`, a jQuery element which should be markup representing
    // a widget, with a `data-options` JSON attribute.

    self.getWidgetOptions = function($widget) {
      return JSON.parse($widget.attr('data-options') || '{}');
    };

    // Fetch the data associated with the specified `$widget`,
    // a jQuery element which should be markup representing a
    // widget. The `data-apos-widget` attribute is used to identify
    // the widget type, and the `getData` method of the manager for
    // that widget type is invoked to get the data.

    self.getWidgetData = function($widget) {
      var manager = self.getWidgetManager($widget.attr('data-apos-widget'));
      if (!manager) {
        apos.utils.warn('WARNING: no manager for widget type ' + $widget.attr('data-apos-widget'));
        return {};
      }
      return manager.getData($widget);
    };

  }
});
