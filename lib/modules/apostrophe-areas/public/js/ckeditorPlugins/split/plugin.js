CKEDITOR.plugins.add('split', {
  icons: 'split',
  init: function(editor) {
    // The command that does what we want
    // eslint-disable-next-line new-cap
    editor.addCommand('split', new CKEDITOR.command(editor, {
      exec: function(editor) {
        var $area = editor.aposWidgetEditor.$widget.closest('[data-apos-area]');
        var $widget = editor.aposWidgetEditor.$widget;
        var areaEditor = $area.data('editor');

        if (areaEditor.limitReached()) {
          // Refuse to play if we'd exceed the limit on items in this
          // area, we don't want to lose content
          return;
        }

        // We need an element to split on.
        // ckeditor's insertElement does not seem to
        // work, but insertText works fine. So
        // insert some unique text and globally
        // replace it with our element

        var splitMarker = apos.utils.generateId();

        apos.ui.globalBusy(true);

        editor.insertText(splitMarker);
        var html = editor.getData();
        html = html.replace(splitMarker, '<span data-a2-split-marker></span>');

        var parts = window.splitHtml(html, 'span[data-a2-split-marker]');
        var html1 = parts[0];
        // parts[1] is the split marker
        var html2 = parts[2];

        return async.series([
          insertTwo,
          insertOne
        ], function() {
          areaEditor.trashItem($widget);
          apos.ui.globalBusy(false);
        });

        function insertTwo(callback) {
          // Work around ckeditor bug that throws console errors as we move
          // between rich text editors by waiting a tick
          return setImmediate(function() {
            return areaEditor.addItem($widget, 'apostrophe-rich-text', {content: html2}, callback);
          });
        }

        function insertOne(callback) {
          // Work around ckeditor bug that throws console errors as we move
          // between rich text editors by waiting a tick
          return setImmediate(function() {
            return areaEditor.addItem($widget, 'apostrophe-rich-text', {content: html1}, callback);
          });
        }
      }
    }));
    // The button that triggers the command
    editor.ui.addButton('Split', {
      label: 'Split in two', // this is the tooltip text for the button
      command: 'split',
      icon: this.path + 'icons/split.png'
    });
  }
});
