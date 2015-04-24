apos.define('apostrophe-rich-text-widgets', {
  extend: 'apostrophe-widgets',
  construct: function(self, options) {
    self.getData = function($widget) {
      // our data is our markup
      var $text = $widget.find('[data-rich-text]');
      // If it's an active contenteditable, use getData() to
      // give ckeditor a chance to clean it up
      var id = $text.attr('id');
      var data;
      if (id && ((typeof CKEDITOR) !== 'undefined')) {
        var instance = CKEDITOR.instances[id];
        if (instance) {
          data = instance.getData();
        }
      }
      if (!data) {
        data = $widget.find('[data-rich-text]').html();
      }
      return {
        type: 'apostrophe-rich-text',
        content: data
      };
    };
  }
});
