/* global rangy, $, _ */
/* global alert, prompt, AposSlideshowWidgetEditor, apos */

function AposButtonsWidgetEditor(options)
{
  var self = this;
  options.template = '.apos-buttons-editor';
  options.type = 'buttons';
  options.options = options.options || {};
  options.options.extraFields = true;
  AposSlideshowWidgetEditor.call(self, options);
}

AposButtonsWidgetEditor.label = "Buttons";
