apos.define('apostrophe-widgets', {

  afterConstruct: function(self) {

    // Declare ourselves the manager for this widget type
    apos.areas.setWidgetManager(self.name, self);

  },

  construct: function(self, options) {
    self.options = options;
    self.name = options.name;
    self.label = options.label;
    self.schema = options.schema;

    // Supply me in your subclass if your widget
    // needs a player, such as a slideshow animation

    // self.play = function($widget, data, options) {

    // }

    // Get the data associated with the widget. By
    // default this is just the data attribute's
    // JSON data, but some widgets, like apostrophe-rich-text,
    // also store data as markup

    self.getData = function($widget) {
      return JSON.parse($widget.attr('data') || '{}');
    };

    self.setData = function($widget, data) {
      $widget.attr('data', JSON.stringify(data));
    };
  }
});
