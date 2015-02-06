/* global rangy, $, _ */
/* global alert, prompt, AposWidgetEditor, apos */

function AposCodeWidgetEditor(options)
{
  var self = this;

  self.code = '';

  if (!options.messages) {
    options.messages = {};
  }
  if (!options.messages.missing) {
    options.messages.missing = 'Paste in some source code first.';
  }

  self.type = 'code';
  options.template = '.apos-code-editor';

  // Parent class constructor shared by all widget editors
  AposWidgetEditor.call(self, options);

  self.afterCreatingEl = function() {
    if (self.exists) {
      self.code = self.$widget.find('pre').text();
    }
    self.$code = self.$el.find('.apos-code');
    self.$code.val(self.code);
    setTimeout(function() {
      self.$code.focus();
      self.$code.setSelection(0, 0);
    }, 500);

    // Automatically preview if we detect something that looks like a
    // fresh paste
    var last = '';
    self.timers.push(setInterval(function() {
      var next = self.$code.val();
      self.exists = (next.length > 2);
      if (next !== last) {
        self.preview();
      }
      last = next;
    }, 500));
  };

  self.getContent = function() {
    return self.$code.val();
  };
}

AposCodeWidgetEditor.label = 'Code';

