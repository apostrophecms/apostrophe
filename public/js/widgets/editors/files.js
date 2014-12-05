/* global rangy, $, _ */
/* global alert, prompt, AposSlideshowWidgetEditor, apos */

function AposFilesWidgetEditor(options)
{
  var self = this;
  options.showImages = false;
  options.template = '.apos-files-editor';
  options.type = 'files';

  // Explicitly avoid limiting to a particular type of file
  self.fileGroup = null;
  AposSlideshowWidgetEditor.call(self, options);
}

AposFilesWidgetEditor.label = "Files";
