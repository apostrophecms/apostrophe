// Implements the ["video" apostrophe schema field type](/reference/field-types/video.md).
//
// The value of the field is an object with `url`, `title` and `thumbnail` properties, the latter
// two being as obtained by `oembetter` at the time the URL was originally pasted and fetched
// via the `oembed` protocol.
//
// This field type is locked down to accept only URLs whose oembed response type
// is `video`.
//
// Videos are not actually hosted or stored by Apostrophe. They are displayed via
// oembed-capable third party services like Vimeo and YouTube.

module.exports = {

  // field type name
  name: 'video',

  // oembed response must be of this type (any if falsy)
  oembedType: 'video',

  alias: 'videoFields',

  afterConstruct: function(self) {
    self.addFieldType();
    self.pushAssets();
    self.pushCreateSingleton();
  },

  construct: function(self, options) {
    self.name = options.name;
    self.oembedType = options.oembedType;

    require('./lib/schemaField')(self, options);
    require('./lib/browser')(self, options);

  }
};
