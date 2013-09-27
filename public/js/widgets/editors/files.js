/* global rangy, $, _ */
/* global alert, prompt, AposSlideshowWidgetEditor, apos */

function AposFilesWidgetEditor(options)
{
  var self = this;
  options.showImages = false;
  options.template = '.apos-files-editor';
  options.type = 'files';
  // We want the default for extra fields to be true rather than false for
  // this widget
  if (!options.options) {
    options.options = {};
  }
  if (options.options.extraFields === undefined) {
    options.options.extraFields = true;
  }
  // Explicitly avoid limiting to a particular type of file
  self.fileGroup = null;
  AposSlideshowWidgetEditor.call(self, options);
}

AposFilesWidgetEditor.label = "Files";
