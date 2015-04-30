apos.define('apostrophe-rich-text-widgets', {
  construct: function(self, options) {

    // does not use a modal, start and stop editing
    // contextually via ckeditor instead

    self.startEditing = function($widget) {
      var options = apos.areas.getWidgetOptions($widget);
      options.$widget = $widget;
      var instance = apos.create('apostrophe-rich-text-editor', options);
      $widget.data('editor', instance);
    };

    self.stopEditing = function($widget) {
      var instance = $widget.data('editor');
      instance.stop();
    };
  }
});
