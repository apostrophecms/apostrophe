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

    self.play = function($widget, data, options) {

      // The player for rich text just makes sure that
      // clicks initiate editing, unless there is an
      // existing editor; there are special cases
      // for clicks onlinks

      if (!self.startEditing) {
        // We're not logged in
        return;
      }

      $widget.on('click', '[data-rich-text]', function(event) {

        // Don't mess with links in the rich text,
        // even editors need to be able to follow links
        // sometimes. They can use the pencil if the
        // entire text is a link

        var editor = $widget.data('editor');

        var $link = $(event.target).closest('a');
        if ($link.length) {
          if (!editor) {
            // There is no editor yet, allow the link
            // to work normally
            return true;
          } else if (editor.focus) {
            // There is already a focused ckeditor instance,
            // so let it handle the click
            return true;
          } else {
            // There is an unfocused ckeditor instance,
            // aggressively force the link to work instead
            // of the ckeditor click-to-edit behavior
            window.location.href = $link.attr('href');
            return false;
          }
        }

        // Not a link

        if (editor) {
          // Let ckeditor take the focus on its own
          return true;
        }

        // We weren't editing yet, so start
        self.startEditing($widget);
      });
    }
  }
});
