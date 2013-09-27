/* global rangy, $, _ */
/* global alert, prompt, AposWidgetEditor, apos */

function AposHtmlWidgetEditor(options)
{
  var self = this;

  self.code = '';

  if (!options.messages) {
    options.messages = {};
  }
  if (!options.messages.missing) {
    options.messages.missing = 'Paste in some HTML code first.';
  }

  self.type = 'html';
  options.template = '.apos-html-editor';

  AposWidgetEditor.call(self, options);

  self.afterCreatingEl = function() {
    self.$code = self.$el.find('.apos-code');
    self.$code.val(self.data.code);
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

  self.getCode = function(callback) {
    var code = self.$code.val();
    self.data.code = code;
    if (callback) {
      callback();
    }
  };

  self.preSave = self.getCode;

  self.prePreview = self.getCode;
}

AposHtmlWidgetEditor.label = 'Raw HTML';

