/* global rangy, $, _ */
/* global alert, prompt, AposSlideshowWidgetEditor, apos */

function AposMarqueeWidgetEditor(options)
{
  var self = this;
  options.template = '.apos-marquee-editor';
  options.type = 'marquee';
  options.options = options.options || {};
  // options.options.extraFields = true;
  AposSlideshowWidgetEditor.call(self, options);
}

AposMarqueeWidgetEditor.label = "Marquee";
