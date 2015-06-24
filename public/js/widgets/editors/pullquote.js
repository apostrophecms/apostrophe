/* global rangy, $, _ */
/* global alert, prompt, AposWidgetEditor, apos */

function AposPullquoteWidgetEditor(options)
{
  var self = this;

  self.pullquote = '';

  if (!options.messages) {
    options.messages = {};
  }
  if (!options.messages.missing) {
    options.messages.missing = 'Type in a pullquote first.';
  }

  self.type = 'pullquote';
  options.template = '.apos-pullquote-editor';

  // Parent class constructor shared by all widget editors
  AposWidgetEditor.call(self, options);

  self.afterCreatingEl = function() {
    if (self.exists) {
      self.pullquote = self.$widget.find('.apos-pullquote-text').text();
    }
    self.$pullquote = self.$el.find('.apos-embed');
    self.$pullquote.val(self.pullquote);
    setTimeout(function() {
      self.$pullquote.focus();
    }, 500);

    // Automatically preview if we detect something that looks like a
    // fresh paste
    var last = '';
    self.timers.push(setInterval(function() {
      var next = self.$pullquote.val();
      self.exists = (next.length > 2);
      if (next !== last) {
        self.preview();
      }
      last = next;
    }, 500));
  };

  self.getContent = function() {
    return self.$pullquote.val();
  };
}

AposPullquoteWidgetEditor.label = 'Pullquote';

