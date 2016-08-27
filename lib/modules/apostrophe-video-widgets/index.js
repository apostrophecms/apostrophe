// Provides the `apostrophe-video` widget, which displays videos, powered
// by [apostrophe-video-field](../apostrophe-video-field/index.html) and
// [apostrophe-oembed](../apostrophe-oembed/index.html). The video
// widget accepts the URL of a video on any website that supports the
// [oembed](http://oembed.com/) standard, including vimeo, YouTube, etc.
// In some cases the results are refined by oembetter filters configured
// by the `apostrophe-oembed` module. It is possible to configure new filters
// for that module to handle video sites that don't natively support oembed.
//
// Videos are not actually hosted or stored by Apostrophe.

module.exports = {
  extend: 'apostrophe-widgets',
  label: 'Video',
  beforeConstruct: function(self, options) {
    options.addFields = [
      {
        type: 'video',
        name: 'video',
        label: 'Video URL',
        required: true
      }
    ].concat(options.addFields || []);
  },
  construct: function(self, options) {
    self.pushAsset('stylesheet', 'always', { when: 'always' });
  }
};
