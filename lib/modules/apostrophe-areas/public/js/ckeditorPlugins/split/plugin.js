CKEDITOR.plugins.add( 'split', {
    icons: 'split',
    init: function(editor) {
      // The command that does what we want
      editor.addCommand('split', new CKEDITOR.command(editor, {
        exec: function(editor) {
          if (editor.a2Area.limitReached()) {
            // Refuse to play if we'd exceed the limit on items in this
            // area, we don't want to lose content
            return;
          }

          // We need an element to split on.
          // ckeditor's insertElement does not seem to
          // work, but insertText works fine. So
          // insert some unique text and globally
          // replace it with our element

          var splitMarker = apos.generateId();

          apos.ui.globalBusy(true);

          editor.insertText(splitMarker);
          var html = editor.getData();
          html = html.replace(splitMarker, '<span data-a2-split-marker></span>');

          var parts = window.splitHtml(html, 'span[data-a2-split-marker]');
          var html1 = parts[0];
          // parts[1] is the split marker
          var html2 = parts[2];

          apos.afterYield(function() {
            editor.a2Area.$insertItemContext = editor.$a2Item;
            // So they wind up in the right order - inserts push down
            editor.a2Area.addRichText(html2, false);
            editor.a2Area.addRichText(html1, false);
            apos.afterYield(function() {
              editor.a2Area.trashItem(editor.$a2Item);
              apos.ui.globalBusy(false);
            });
          });
        }
      }));
      // The button that triggers the command
      editor.ui.addButton('split', {
        label: 'Split in two', //this is the tooltip text for the button
        command: 'split',
        icon: this.path + 'icons/split.png'
      });
    }
});
