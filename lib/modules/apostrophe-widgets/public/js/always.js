// `apostrophe-widgets` is a parent class for the browser-side managers of
// widget types. Each manager object is responsible for *all* widgets of that type.
//
// Extends `apostrophe-context` in order to gain access to conveniences like
// the `self.api` and `self.html` methods. There is no `self.$el`, because
// this object manages many widgets.
//
// The `play` method, if it exists, is invoked when appropriate with `($widget, data, options)`,
// and should enhance that specific widget. The `play` method should **never** use
// `$(...)` selectors, instead always using `$widget.find(...)` to scope them to that
// specific widget.

apos.define('apostrophe-widgets', {

  extend: 'apostrophe-context',

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

    // Returns true if we are allowed to edit this widget.
    // Independent of `getData` because that is sometimes
    // overridden but this is always the right place to get
    // the `_edit` flag from.
    //
    // If editing would otherwise be permitted but is specifically
    // disabled for this area for workflow reasons, false is returned.

    self.canEdit = function($widget) {
      var data = JSON.parse($widget.attr('data') || '{}');
      var result = data._edit && (!$widget.closest('[data-apos-area-disabled-editing]').length);
      return result;
    };
  }
});
