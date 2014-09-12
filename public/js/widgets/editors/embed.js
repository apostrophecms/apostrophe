/* global rangy, $, _ */
/* global alert, prompt, AposVideoWidgetEditor, apos */

function AposEmbedWidgetEditor(options)
{
  var self = this;
  if (!options.messages) {
    options.messages = {};
  }
  if (!options.messages.missing) {
    options.messages.missing = 'Paste a link first.';
  }
  options.template = '.apos-embed-editor';
  options.type = 'embed';
  options.options = options.options || {};
  // options.options.extraFields = true;
  AposVideoWidgetEditor.call(self, options);
}

AposEmbedWidgetEditor.label = "Embed";
