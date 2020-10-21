// Provides the `@apostrophecms/video` widget, which displays videos, powered
// by [@apostrophecms/video-field](../@apostrophecms/video-field/index.html) and
// [@apostrophecms/oembed](../@apostrophecms/oembed/index.html). The video
// widget accepts the URL of a video on any website that supports the
// [oembed](http://oembed.com/) standard, including vimeo, YouTube, etc.
// In some cases the results are refined by oembetter filters configured
// by the `@apostrophecms/oembed` module. It is possible to configure new filters
// for that module to handle video sites that don't natively support oembed.
//
// Videos are not actually hosted or stored by Apostrophe.

module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'Video',
    className: false
  },
  fields: {
    add: {
      video: {
        type: 'video',
        name: 'video',
        label: 'Video URL',
        required: true
      }
    }
  }
};
